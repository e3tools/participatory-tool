import frappe
from frappe.core.doctype.user.user import generate_keys
import datetime
from frappe.utils import getdate
from frappe import _


def generate_user_api_keys():
    """
    Generate API Keys for users
    """
    or_filters = {"api_key": None, "api_secret": None, "api_key": "", "api_secret": ""}
    users = frappe.get_all("User", fields=["name", "enabled"], or_filters=or_filters)
    for usr in users:
        if usr.enabled and usr.name not in ["Administrator", "Guest"]:
            generate_keys(usr.name)


def unpublish_webforms():
    """
    Loop through engagement forms and unpublish those that have expired timeline
    """
    forms = frappe.db.get_all(
        "Engagement Form",
        filters={"field_is_table": 0, "enable_web_form": 1},
        fields=["name", "publish_start_date", "publish_end_date"],
    )

    now = datetime.datetime.now()
    for frm in forms:
        start = frm.publish_start_date
        end = frm.publish_end_date
        if not start:
            start = datetime.date.min
        if not end:
            end = datetime.date.max
        if getdate(start) <= getdate(now) <= getdate(end):
            # today is within the acceptable date range
            continue
        else:
            # disable web form
            web_forms = frappe.db.get_all(
                "Web Form", filters={"doc_type": frm.name}, fields=["name", "published"]
            )
            for web_form in web_forms:
                if web_form.published:
                    # frappe.db.set_value(
                    #     "Web Form", web_form.name, "published", False, True
                    # )
                    doc = frappe.get_doc("Web Form", web_form.name)
                    # doc.db_set("published", 0, True, False, True)
                    doc.flags.updater_reference = {
                        "doctype": "Engagement Form",
                        "docname": frm.name,
                        "label": _(f"via Engagement Form {frm.name}"),
                    }
                    doc.published = False
                    doc.save(ignore_permissions=True)
