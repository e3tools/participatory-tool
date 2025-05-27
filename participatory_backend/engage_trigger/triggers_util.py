import frappe
from frappe.modules.utils import get_doctype_module
from frappe.email.doctype.notification.notification import get_context
from frappe.model.document import Document
from frappe.utils import cast
from participatory_backend.engage_trigger.doctype.engagement_trigger.engagement_trigger import (
    EngagementTrigger,
)


def run_triggers(doc: Document, method):
    if not get_doctype_module(doc.doctype) == "Engage":
        return
    if doc.flags.in_notification_update:
        return
    if doc.doctype == "Engagement Trigger":
        return

    def _on_new(trigger: EngagementTrigger):
        pass

    def _on_value_change(trigger: EngagementTrigger):
        pass

    triggers = frappe.db.get_list(
        "Engagement Trigger",
        {"enabled": 1, "engagement_form": doc.doctype},
        ["name"],
    )
    for t in triggers:
        trigger: EngagementTrigger = frappe.get_doc("Engagement Trigger", t.name)
        if not evaluate_trigger_condition(doc, trigger):
            continue

        if doc.is_new() and trigger.activate_trigger_on == "New":
            _on_new(trigger)
        if trigger.activate_trigger_on == "Value Change":
            _on_value_change(trigger)


def evaluate_trigger_condition(doc, trigger: EngagementTrigger):
    """
    Evaluate trigger condition
    """
    context = get_context(doc)

    if trigger.condition:
        if not frappe.safe_eval(trigger.condition, None, context):
            return

    if trigger.activate_trigger_on == "Value Change" and not doc.is_new():
        if not frappe.db.has_column(doc.doctype, trigger.change_field):
            trigger.db_set("enabled", 0)
            trigger.log_error(
                f"Engagement Trigger {trigger.name} has been disabled due to missing field {trigger.change_field}"
            )
            trigger.add_comment(
                comment_type="Comment",
                text=f"Engagement Trigger {trigger.name} has been disabled due to missing field {trigger.change_field}",
            )
            return

        doc_before_save = doc.get_doc_before_save()
        field_value_before_save = (
            doc_before_save.get(trigger.change_field) if doc_before_save else None
        )

        fieldtype = doc.meta.get_field(trigger.change_field).fieldtype
        if cast(fieldtype, doc.get(trigger.change_field)) == cast(
            fieldtype, field_value_before_save
        ):
            # value not changed
            return
        # else:
        #     if cast(fieldtype, doc.get(trigger.change_field)) != cast(
        #         fieldtype, trigger.change_field_value
        #     ):
        #         # value is not same as the trigger value
        #         return

    if trigger.activate_trigger_on == "New" and doc._doc_before_save:  # doc.is_new():
        return

    if trigger.activate_trigger_on != "Value Change" and not doc.is_new():
        # reload the doc for the latest values & comments,
        # except for validate type event.
        doc.reload()

    trigger.run_trigger(doc)
