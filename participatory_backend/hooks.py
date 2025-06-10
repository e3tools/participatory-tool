from . import __version__ as app_version

app_name = "participatory_backend"
app_title = "Participatory Backend"
app_publisher = "Steve Nyaga"
app_description = "Backend to support participatory process"
app_email = "stevenyaga@gmail.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/participatory_backend/css/participatory_backend.css"
# app_include_js = "/assets/participatory_backend/js/participatory_backend.js"

# include js, css files in header of web template
# web_include_css = "/assets/participatory_backend/css/participatory_backend.css"
# web_include_js = "/assets/participatory_backend/js/participatory_backend.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "participatory_backend/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "participatory_backend.utils.jinja_methods",
# 	"filters": "participatory_backend.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "participatory_backend.install.before_install"
# after_install = "participatory_backend.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "participatory_backend.uninstall.before_uninstall"
# after_uninstall = "participatory_backend.uninstall.after_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "participatory_backend.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

doc_events = {
    "Shape File": {
        # "before_save": "participatory_backend.event_handler.before_save_shape_file"
    },
    "*": {
        # "after_insert": "participatory_backend.engage_trigger.triggers_util.run_triggers",
        "on_update": "participatory_backend.engage_trigger.triggers_util.run_triggers",
    },
}

scheduler_events = {
    "all": [
        # "participatory_backend.tasks.unpublish_webforms",
    ],
    "cron": {
        "0/1 * * * *": [  # run every 1 minute.
            "participatory_backend.tasks.generate_user_api_keys",
        ],
    },
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"participatory_backend.tasks.all"
# 	],
# 	"daily": [
# 		"participatory_backend.tasks.daily"
# 	],
# 	"hourly": [
# 		"participatory_backend.tasks.hourly"
# 	],
# 	"weekly": [
# 		"participatory_backend.tasks.weekly"
# 	],
# 	"monthly": [
# 		"participatory_backend.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "participatory_backend.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "participatory_backend.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "participatory_backend.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Automatically update python controller files with type annotations for this app.
export_python_type_annotations = True

# Request Events
# ----------------
# before_request = ["participatory_backend.utils.before_request"]
# after_request = ["participatory_backend.utils.after_request"]

# Job Events
# ----------
# before_job = ["participatory_backend.utils.before_job"]
# after_job = ["participatory_backend.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"participatory_backend.auth.validate"
# ]

CUSTOM_ROLES = (
    "Form Design User",
    "Form Design Manager",
    "Technical Data User",
    "Technical Data Manager",
    "Data Capture",
)

fixtures = [
    {
        "doctype": "Custom Field",
        "filters": [
            ["fieldname", "in", ("engagement_entry", "engagement_entry_status")],
            ["dt", "in", ("Shape File",)],
        ],
    },
    {"doctype": "Custom DocPerm", "filters": [["role", "in", CUSTOM_ROLES]]},
    {"doctype": "Role", "filters": [["name", "in", CUSTOM_ROLES]]},
    # {
    #   "doctype":"PCRA Form"
    # },
    # {
    #   "doctype":"Resource Type"
    # },
    # {
    #   "doctype":"Hazard Type"
    # },
    # {
    #   "doctype":"Hazard Exposure Object"
    # },
    # {
    #   "doctype":"Administrative Level"
    # },
    # {
    #   "doctype":"Process Type"
    # },
    # {
    #   "doctype":"Vulnerable Group"
    # },
    #   {
    #     "doctype":"Workspace",
    #     "filters": [
    #           [
    #               "name", "in", ["Engage"]
    #           ]
    #       ]
    #   },
]
