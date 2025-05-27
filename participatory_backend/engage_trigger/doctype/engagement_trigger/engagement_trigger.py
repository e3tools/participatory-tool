# Copyright (c) 2025, Steve Nyaga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import cast


class EngagementTrigger(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF
        from participatory_backend.engage_trigger.doctype.engagement_trigger_related_form_item.engagement_trigger_related_form_item import (
            EngagementTriggerRelatedFormItem,
        )
        from participatory_backend.engage_trigger.doctype.engagement_trigger_update_form_field_item.engagement_trigger_update_form_field_item import (
            EngagementTriggerUpdateFormFieldItem,
        )

        activate_trigger_on: DF.Literal["", "New", "Value Change"]
        change_field: DF.Literal[None]
        condition: DF.SmallText | None
        enabled: DF.Check
        engagement_form: DF.Link
        field_linking_forms: DF.Literal[None]
        outcome_type: DF.Literal[
            "",
            "Update Current Record",
            "Create Another Form Record",
            "Update Another Form Record",
        ]
        related_form: DF.Link | None
        related_form_field_items: DF.Table[EngagementTriggerRelatedFormItem]
        set_property_after_trigger_items: DF.Table[EngagementTriggerUpdateFormFieldItem]
        trigger_name: DF.Data
    # end: auto-generated types
    pass

    def validate(self):
        pass

    def run_trigger(self, doc: Document):
        def validate_field_exists(doctype: str, fieldname: str):
            if not frappe.db.has_column(doctype, fieldname):
                self.flags.updater_reference = {
                    "doctype": self.doctype,
                    "docname": self.name,
                    "label": _(
                        f"Disabled due to missing field {fieldname} in {doctype}"
                    ),
                }
                self.enabled = False
                self.flags.in_notification_update = True
                self.flags.ignore_mandatory = True
                self.save(ignore_permissions=True)
                self.flags.in_notification_update = False
                self.log_error(
                    f"Engagement Trigger {self.name} has been disabled due to missing field {fieldname}"
                )
                return False

            return True

        def set_field_value(target_doc: Document, fieldname: str, value):
            allow_update = True
            if (
                target_doc.docstatus.is_submitted()
                and not target_doc.meta.get_field(fieldname).allow_on_submit
            ):
                allow_update = False

            if allow_update and not target_doc.flags.in_notification_update:
                fieldtype = target_doc.meta.get_field(fieldname).fieldtype
                if fieldtype in frappe.model.numeric_fieldtypes:
                    value = frappe.utils.cint(value)

                value = cast(fieldtype, value)
                target_doc.set(fieldname, value)

        def save_doc(document: Document):
            # save with updates
            try:
                is_new = document.is_new()
                document.flags.updater_reference = {
                    "doctype": self.doctype,
                    "docname": self.name,
                    "label": _(f"via Engagement Trigger {self.name}"),
                }
                document.flags.in_notification_update = True
                document.flags.ignore_mandatory = True
                document.save(ignore_permissions=True)
                document.flags.in_notification_update = False

                if is_new:
                    document.add_comment(
                        comment_type="Comment",
                        text=_(
                            f"Created via Engagement Trigger {self.name}. {doc.doctype}: {doc.name}"
                        ),
                    )

            except Exception:
                self.log_error("Document update failed")

        try:
            if self.outcome_type == "Update Current Record":
                doc.reload()  # get current values

                # validate fields first before processing triggers
                for fld in self.set_property_after_trigger_items:
                    fieldname = fld.field_to_update
                    value = fld.field_to_update_value
                    if not validate_field_exists(self.engagement_form, fieldname):
                        return

                # update values of current record
                for fld in self.set_property_after_trigger_items:
                    fieldname = fld.field_to_update
                    value = fld.field_to_update_value
                    set_field_value(doc, fieldname, value)

                # save with updates
                save_doc(doc)

            if self.outcome_type == "Create Another Form Record":
                doc.reload()  # get current values

                for fld in self.related_form_field_items:
                    # validate source doc field
                    if (
                        fld.source == "From Current Form Field"
                        and not validate_field_exists(
                            self.engagement_form, fld.current_form_field
                        )
                    ):
                        return
                    # validate target doc field
                    if not validate_field_exists(
                        self.related_form, fld.related_form_field
                    ):
                        return

                # create target doc
                new_doc = frappe.new_doc(self.related_form)
                for fld in self.related_form_field_items:
                    fieldname = fld.related_form_field
                    value = None
                    if fld.source == "From Current Form Field":
                        value = doc.get(fld.current_form_field)
                    elif fld.source == "Specific Value":
                        value = fld.update_value

                    set_field_value(new_doc, fieldname, value)

                # save new doc with updates
                save_doc(new_doc)

            if self.outcome_type == "Update Another Form Record":
                # update another form record
                doc.reload()  # get current values
                # validate the linking field exists in the current record
                if not validate_field_exists(
                    self.engagement_form, self.field_linking_forms
                ):
                    return

                # get related docs that are associated with the triggering doc
                related_docs = frappe.db.get_list(
                    self.related_form,
                    filters={"name": doc.get(self.field_linking_forms)},
                    fields=["name"],
                )
                for rec in related_docs:
                    target_doc = frappe.get_doc(self.related_form, rec.name)
                    for fld in self.related_form_field_items:
                        fieldname = fld.related_form_field
                        value = None
                        if fld.source == "From Current Form Field":
                            value = doc.get(fld.current_form_field)
                        elif fld.source == "Specific Value":
                            value = fld.update_value

                        set_field_value(target_doc, fieldname, value)

                    # save existing doc with updates
                    save_doc(target_doc)

        except Exception as e:
            self.log_error("Failed to trigger notification")
