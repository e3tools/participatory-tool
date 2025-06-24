import frappe
from participatory_backend.engage.doctype.engagement_form.engagement_form import (
    doctype_to_engagement_form,
    EngagementForm,
)
from frappe.utils import today, add_days


def execute():
    """
    Initialize self registration form
    """
    if frappe.flags.in_initializing_context:
        return

    frappe.flags.in_initializing_context = True
    form: EngagementForm = None
    if not frappe.db.exists("Engagement Form", "Self Registration"):
        form: EngagementForm = doctype_to_engagement_form("Self Registration")
        form.use_field_to_generate_id = 1
        form.naming_field = "personnel_number"
        form.enable_web_form = 1
    else:
        form = frappe.get_doc("Engagement Form", "Self Registration")

    # unpublish in 3 days
    form.publish_start_date = today()
    form.publish_end_date = add_days(today(), 3)
    form.save(ignore_permissions=True)
    frappe.flags.in_initializing_context = False
