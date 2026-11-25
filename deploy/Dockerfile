FROM frappe/erpnext:version-15

USER root
# Install curl to download wait-for-it
RUN apt-get update -o Acquire::AllowInsecureRepositories=true -o Acquire::AllowDowngradeToInsecureRepositories=true \
    && apt-get install --no-install-recommends -y \
    && apt-get install -y curl \
    # ----------------------------------------------------
    # 📍 ADDED: System EngageTool dependencies for Fiona & Shapely (GDAL & GEOS)
    # ----------------------------------------------------
    libgdal-dev \
    gdal-bin \
    libgeos-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Download wait-for-it script
ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh /usr/local/bin/wait-for-it
RUN chmod 755 /usr/local/bin/wait-for-it

USER frappe
WORKDIR /home/frappe/frappe-bench

RUN echo "Installing base apps"
RUN bench get-app gis https://github.com/e3tools/participatory-tool-gis.git --branch main
RUN bench get-app participatory_backend https://github.com/e3tools/participatory-tool.git --branch main
 
RUN echo "Install requirements.txt"

# prevent any pip command in your Dockerfile from upgrading NumPy to 2.x
RUN echo "numpy<2" > /tmp/pip-constraints.txt
ENV PIP_CONSTRAINT=/tmp/pip-constraints.txt

# --------------------------------------------------------------------------
# 📍 ADDED: Install Fiona & Shapely (geospatial) into the bench Python venv
# --------------------------------------------------------------------------
RUN /home/frappe/frappe-bench/env/bin/pip install fiona && \
  /home/frappe/frappe-bench/env/bin/pip install shapely && \
  /home/frappe/frappe-bench/env/bin/pip install geoserver-rest && \
  /home/frappe/frappe-bench/env/bin/pip install geopandas && \
  /home/frappe/frappe-bench/env/bin/pip install rasterio && \
  cd /home/frappe/frappe-bench && \
  # 1. Install GIS dependencies & pySLD from GitHub
  # Git clone pysld
  # Replace scipy entry in requirements.txt with scipy==1.10.0
  # Putting pysld in requirements causes issues in installation. So install it separately 
  git clone https://github.com/iamtekson/pySLD.git /tmp/pysld && \
  # If requirements.txt exists, install it after replacing scipy version
  if [ -f /tmp/pysld/requirements.txt ]; then \
    echo "📦 Replacing scipy version for pysld..."; \
    sed -i.bak -E 's/^scipy([<>=!~].*)?$/scipy==1.10.0/' /tmp/pysld/requirements.txt; \
    echo "numpy<2" >> /tmp/pysld/requirements.txt; \
    echo "📦 Installing requirements for pysld..."; \
    /home/frappe/frappe-bench/env/bin/pip install --no-cache-dir -r /tmp/pysld/requirements.txt; \
  fi && \
  /home/frappe/frappe-bench/env/bin/pip install --no-cache-dir /tmp/pysld && \
  # Clean layer size: Removing /tmp/pySLD right after installation prevents unneeded Git history and temporary files from cluttering your image.
  rm -rf /tmp/pysld && \
  # 2.📍 Dynamically install requirements for ALL apps cloned via apps.json
  for APP_DIR in apps/*; do \
    if [ -d "$APP_DIR" ]; then \
      if [ -f "$APP_DIR/requirements.txt" ]; then \
        echo "📦 Installing requirements for $APP_DIR..."; \
        /home/frappe/frappe-bench/env/bin/pip install --no-cache-dir -r "$APP_DIR/requirements.txt"; \
      fi; \
      if [ -f "$APP_DIR/setup.py" ] || [ -f "$APP_DIR/pyproject.toml" ]; then \
        echo "🔧 Installing package $APP_DIR..."; \
        /home/frappe/frappe-bench/env/bin/pip install --no-cache-dir -e "$APP_DIR"; \
      fi; \
    fi; \
  done && \
  # 3. Finalize setup & clean up git metadata
  echo "{}" > sites/common_site_config.json && \
  find apps -mindepth 1 -path "*/.git" | xargs rm -fr

# # --- STAGE 2: PRODUCTION ---
# # This official image already contains perfectly compiled frappe & erpnext code
# FROM frappe/erpnext:${FRAPPE_BRANCH} AS production

COPY --chown=frappe:frappe deploy/create-sites.sh /home/frappe/frappe-bench/create-sites.sh
COPY --chown=frappe:frappe deploy/create-single-site.sh /home/frappe/frappe-bench/create-single-site.sh
COPY --chown=frappe:frappe deploy/create-multiple-sites.sh /home/frappe/frappe-bench/create-multiple-sites.sh

RUN chmod +x /home/frappe/frappe-bench/create-sites.sh
RUN chmod +x /home/frappe/frappe-bench/create-single-site.sh
RUN chmod +x /home/frappe/frappe-bench/create-multiple-sites.sh

# make this `ENTRYPOINT_SCRIPT` argument to allow creating single and multiple sites 
# An example on how to call:
#   docker build \
#  --build-arg ENTRYPOINT_SCRIPT=create-multiple-sites.sh \
#  -t my-app:worker .

# ENTRYPOINT ["/home/frappe/frappe-bench/create-sites.sh"]

# ARG values disappear after the image build unless promoted to ENV
ARG ENTRYPOINT_SCRIPT=create-single-site.sh
ENV ENTRYPOINT_SCRIPT=${ENTRYPOINT_SCRIPT}

ENTRYPOINT ["/bin/bash", "-c", "exec /home/frappe/frappe-bench/${ENTRYPOINT_SCRIPT}"]
