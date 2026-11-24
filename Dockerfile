ARG PYTHON_VERSION=3.11.6
ARG DEBIAN_BASE=bookworm
FROM python:${PYTHON_VERSION}-slim-${DEBIAN_BASE} AS base

ARG WKHTMLTOPDF_VERSION=0.12.6.1-3
ARG WKHTMLTOPDF_DISTRO=bookworm
ARG NODE_VERSION=18.18.2
ENV NVM_DIR=/home/frappe/.nvm
ENV PATH ${NVM_DIR}/versions/node/v${NODE_VERSION}/bin/:${PATH}

RUN useradd -ms /bin/bash frappe \
    && apt-get update \
    && apt-get install --no-install-recommends -y \
    curl \
    git \
    vim \
    nano \
    nginx \
    gettext-base \
    file \
    # weasyprint dependencies
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    # For backups
    restic \
    gpg \
    # MariaDB
    mariadb-client \
    less \
    # Postgres
    libpq-dev \
    postgresql-client \
    # For healthcheck
    wait-for-it \
    jq \
    # NodeJS
    && mkdir -p ${NVM_DIR} \
    && curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash \
    && . ${NVM_DIR}/nvm.sh \
    && nvm install ${NODE_VERSION} \
    && nvm use v${NODE_VERSION} \
    && npm install -g yarn \
    && nvm alias default v${NODE_VERSION} \
    && rm -rf ${NVM_DIR}/.cache \
    && echo 'export NVM_DIR="/home/frappe/.nvm"' >>/home/frappe/.bashrc \
    && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm' >>/home/frappe/.bashrc \
    && echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion' >>/home/frappe/.bashrc \
    # Install wkhtmltopdf with patched qt
    && if [ "$(uname -m)" = "aarch64" ]; then export ARCH=arm64; fi \
    && if [ "$(uname -m)" = "x86_64" ]; then export ARCH=amd64; fi \
    && downloaded_file=wkhtmltox_${WKHTMLTOPDF_VERSION}.${WKHTMLTOPDF_DISTRO}_${ARCH}.deb \
    && curl -sLO https://github.com/wkhtmltopdf/packaging/releases/download/$WKHTMLTOPDF_VERSION/$downloaded_file \
    && apt-get install -y ./$downloaded_file \
    && rm $downloaded_file \
    # Clean up
    && rm -rf /var/lib/apt/lists/* \
    && rm -fr /etc/nginx/sites-enabled/default \
    && pip3 install frappe-bench \
    # Fixes for non-root nginx and logs to stdout
    && sed -i '/user www-data/d' /etc/nginx/nginx.conf \
    && ln -sf /dev/stdout /var/log/nginx/access.log && ln -sf /dev/stderr /var/log/nginx/error.log \
    && touch /run/nginx.pid \
    && chown -R frappe:frappe /etc/nginx/conf.d \
    && chown -R frappe:frappe /etc/nginx/nginx.conf \
    && chown -R frappe:frappe /var/log/nginx \
    && chown -R frappe:frappe /var/lib/nginx \
    && chown -R frappe:frappe /run/nginx.pid

# COPY resources/nginx-template.conf /templates/nginx/frappe.conf.template
# COPY resources/nginx-entrypoint.sh /usr/local/bin/nginx-entrypoint.sh

FROM base AS builder

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y \
    # For frappe framework
    wget \
    # For psycopg2
    libpq-dev \
    # Other
    libffi-dev \
    liblcms2-dev \
    libldap2-dev \
    libmariadb-dev \
    libsasl2-dev \
    libtiff5-dev \
    libwebp-dev \
    redis-tools \
    rlwrap \
    tk8.6-dev \
    cron \
    # For pandas
    gcc \
    build-essential \
    libbz2-dev \
    && rm -rf /var/lib/apt/lists/*

# GDAL dependencies
RUN apt-get update && apt-get install -y gdal-bin apt-utils libgdal-dev

# Run this to install geoserver-rest dependencies
RUN pip install pygdal=="`gdal-config --version`.*"
# RUN pip install pygdal==2.4.2.10

RUN pip install -I GDAL=="`gdal-config --version`.*"

RUN pip3 install pygdal=="`gdal-config --version`.*"

RUN pip install geoserver-rest

# install app dependencies
# RUN pip install -r requirements.txt

# Putting pysld in requirements causes issues in installation. So install it separately
#RUN wget https://files.pythonhosted.org/packages/58/f0/fa2a1f3c6b2164b19801874bca2dac69deaaec3b30aeefebaba1bfb9e6c2/scipy-1.6.2-cp39-cp39-manylinux1_x86_64.whl
#RUN pip install scipy-1.6.2-cp39-cp39-manylinux1_x86_64.whl
#RUN pip install pysld

USER frappe

ARG FRAPPE_BRANCH=version-15
ARG FRAPPE_PATH=https://github.com/frappe/frappe
ARG ERPNEXT_REPO=https://github.com/frappe/erpnext
ARG ERPNEXT_BRANCH=version-15
RUN bench init \
  --frappe-branch=${FRAPPE_BRANCH} \
  --frappe-path=${FRAPPE_PATH} \
  --no-procfile \
  --no-backups \
  --skip-redis-config-generation \
  --verbose \
  /home/frappe/frappe-bench && \
  cd /home/frappe/frappe-bench && \
  bench get-app --branch=${ERPNEXT_BRANCH} --resolve-deps erpnext ${ERPNEXT_REPO} && \
  echo '{"socketio_port": 9000}' > sites/common_site_config.json && \
  find apps -mindepth 1 -path "*/.git" | xargs rm -fr

# Install pysld after initializing bench
RUN cd /home/frappe

RUN ls -lt

# create pysld folder, cd into it and clone repo
RUN mkdir ~/pysld && cd ~/pysld && git clone -v https://github.com/iamtekson/pySLD.git pysld

#RUN cat requirements_dev.txt

# replace scipy 1.6.2 with 1.7.2 as 1.6.2 has no installation candidate
#RUN sed -i 's/scipy==1.6.2/scipy==1.7.2/' requirements_dev.txt

# change to frappe dir
#RUN cd /home/frappe/frappe-bench

# install pysld into the frappe virtual env
# RUN ./env/bin/pip install -e /home/frappe/frappe-bench/env/pysld
RUN /home/frappe/frappe-bench/env/bin/python -m pip install --quiet --upgrade -e ~/pysld/pysld
RUN /home/frappe/frappe-bench/env/bin/python -m pip install pygdal=="`gdal-config --version`.*"
RUN /home/frappe/frappe-bench/env/bin/python -m pip install gdal==`gdal-config --version`

RUN cd /home/frappe/frappe-bench && bench get-app --branch main insights https://github.com/frappe/insights.git && \
bench get-app --branch main --resolve-deps gis https://gitlab.com/steve.nyaga/gis.git && \
bench get-app --branch develop --resolve-deps participatory_backend https://github.com/e3tools/participatory-backend.git && \
/home/frappe/frappe-bench/env/bin/python -m pip install -r /home/frappe/frappe-bench/apps/gis/requirements.txt && \
/home/frappe/frappe-bench/env/bin/python -m pip install -r /home/frappe/frappe-bench/apps/participatory_backend/requirements.txt

# FROM base as erpnext

USER frappe

# COPY --from=builder --chown=frappe:frappe /home/frappe/frappe-bench /home/frappe/frappe-bench

WORKDIR /home/frappe/frappe-bench

#USER root

#RUN apt-get update
#RUN apt-get install -y python3-scipy python3-numpy python3-pandas

#RUN pip install pysld==0.0.3

USER frappe
 
VOLUME [ \
  "/home/frappe/frappe-bench/sites", \
  "/home/frappe/frappe-bench/sites/assets", \
  "/home/frappe/frappe-bench/logs" \
]

CMD [ \
  "/home/frappe/frappe-bench/env/bin/gunicorn", \
  "--chdir=/home/frappe/frappe-bench/sites", \
  "--bind=0.0.0.0:8000", \
  "--threads=4", \
  "--workers=2", \
  "--worker-class=gthread", \
  "--worker-tmp-dir=/dev/shm", \
  "--timeout=120", \
  "--preload", \
  "--reload", \
  "frappe.app:application" \
]
