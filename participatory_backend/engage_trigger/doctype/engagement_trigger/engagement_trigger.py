# Copyright (c) 2025, Steve Nyaga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import cast, validate_email_address, today, getdate, nowtime, now
from frappe.email.doctype.notification.notification import get_context
from frappe.core.doctype.sms_settings.sms_settings import send_sms
import json
from frappe.desk.doctype.notification_log.notification_log import (
    enqueue_create_notification,
)
from frappe.core.doctype.role.role import get_info_based_on_role, get_user_info
from participatory_backend.utils.common import is_float


class EngagementTrigger(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF
        from participatory_backend.engage_trigger.doctype.engage_trigger_recipient_item.engage_trigger_recipient_item import (
            EngageTriggerRecipientItem,
        )
        from participatory_backend.engage_trigger.doctype.engagement_trigger_related_form_item.engagement_trigger_related_form_item import (
            EngagementTriggerRelatedFormItem,
        )
        from participatory_backend.engage_trigger.doctype.engagement_trigger_update_form_field_item.engagement_trigger_update_form_field_item import (
            EngagementTriggerUpdateFormFieldItem,
        )

        activate_trigger_on: DF.Literal["", "New", "Value Change", "Time Lapse"]
        attach_print: DF.Check
        change_field: DF.Literal[None]
        channel: DF.Literal["Email", "SMS"]
        condition: DF.SmallText | None
        enabled: DF.Check
        engagement_form: DF.Link
        field_linking_forms: DF.Literal[None]
        form_group: DF.Data | None
        message: DF.Code | None
        outcome_type: DF.Literal[
            "",
            "None",
            "Update Current Record",
            "Create Another Form Record",
            "Update Another Form Record",
        ]
        print_format: DF.Link | None
        recipients: DF.Table[EngageTriggerRecipientItem]
        related_form: DF.Link | None
        related_form_field_items: DF.Table[EngagementTriggerRelatedFormItem]
        send_communication: DF.Check
        send_system_notification: DF.Check
        sender: DF.Link | None
        sender_email: DF.Data | None
        set_property_after_trigger_items: DF.Table[EngagementTriggerUpdateFormFieldItem]
        subject: DF.Data | None
        trigger_name: DF.Data
    # end: auto-generated types
    pass

    def validate(self):
        # check cyclic dependency
        if self.outcome_type in [
            "Update Another Form Record",
            "Create Another Form Record",
        ]:
            if self.related_form == self.engagement_form:
                frappe.throw(
                    _("Related Form cannot be the same as the Engagement Form")
                )
        # check that if the selected outcome is None, we must set communicate to true
        if self.enabled and self.outcome_type == "None" and not self.send_communication:
            frappe.throw(
                _(
                    "When the outcome type is None, you must enable send communication. Else disable the trigger"
                )
            )

        if self.activate_trigger_on == "Time Lapse" and not self.condition:
            frappe.throw(
                _(
                    "When the Activate Trigger On is Time Lapse, you must specify the condition(s)"
                )
            )
        self.validate_update_values()

    def _do_validate_update_value(self, target_form_field, value_to_update, idx):
        # field = [x for x in target_form_fields if x.fieldname == field_to_update]
        field_type = target_form_field.get("fieldtype")
        # validate Data
        if len(value_to_update) > 140:
            frappe.throw(
                _(
                    f"Row {idx}. The update value cannot be longer than 140 characters long. Please remove any leading or trailing spaces"
                )
            )
        # validate select
        if field_type == "Select":
            options = target_form_field.get("options")
            select_options = [option for option in options.split("\n") if option]
            # check if value to update is one of the options
            if value_to_update not in select_options:
                frappe.throw(
                    _(
                        f"Row {idx}. The specified update value cannot be {frappe.bold(value_to_update)}. It must be one of {frappe.bold(str(select_options))}"
                    )
                )
        # validate numerics
        if field_type in [
            "Currency",
            "Int",
            "Float",
            "Percent",
            "Duration",
        ]:
            if not is_float(value_to_update):
                frappe.throw(
                    _(
                        f"Row {idx}. The specified update value [{frappe.bold(value_to_update)}] is not a number"
                    )
                )

        if field_type in ["Date", "Datetime", "Time"]:
            if not value_to_update.strip():
                frappe.throw(_("Row {fld.idx}. Update value cannot be empty"))

        if field_type == "Date":
            if value_to_update.strip().lower() not in [
                "today",
                "now",
            ]:
                getdate(
                    value_to_update
                )  # this will throw an exception if its not a valid date

    def _do_validate_source_to_target_fields(self, source_field, target_field, idx):
        # When the source field is specified as ID, check if the target is a Link of type Current Form
        if source_field == "name":
            # make an object as the source field will come in as a string
            source_field = {"fieldtype": "Data", "fieldname": "name"}

        if (
            source_field.get("fieldname") == "name"
            and target_field.get("fieldtype") == "Link"
        ):
            if target_field.get("options") != self.engagement_form:
                frappe.throw(
                    _(
                        f"Row {idx}. The ID field cannot update a link field of a type other than {frappe.bold(self.engagement_form)}."
                    )
                )
            else:  # do not proceed further
                return

        if source_field.get("fieldtype") != target_field.get("fieldtype"):
            frappe.throw(
                _(
                    f"Row {idx}. The field type of the related form and the current form must be the same."
                )
            )
        # if links , ensure the options are the same
        if source_field.get("fieldtype") == "Link":
            source_options = source_field.get("options")
            target_options = target_field.get("options")
            if source_options != target_options:
                frappe.throw(
                    _(
                        f"Row {idx}. Both the source and target fields must have the same Form associated. The source is linked to {frappe.bold(source_options)} while the target is linked to {frappe.bold(target_options)}"
                    )
                )

        # if select, ensure both source and target have same choices
        if source_field.get("fieldtype") == "Select":
            source_options = [
                option for option in source_field.get("options").split("\n") if option
            ]
            target_options = [
                option for option in target_field.get("options").split("\n") if option
            ]
            if sorted(source_options) != sorted(target_options):
                frappe.throw(
                    _(
                        f"Row {idx}. Both source and target field must have the same Select choices."
                    )
                )

    def validate_update_values(self):
        """
        Check that the values to use for updating are valid values
        """
        if self.outcome_type == "Update Current Record":
            fields = frappe.get_meta(self.engagement_form).fields
            for fld in self.set_property_after_trigger_items:
                field = [x for x in fields if x.fieldname == fld.field_to_update]
                if field:
                    self._do_validate_update_value(
                        field[0], fld.field_to_update_value, fld.idx
                    )

        if self.outcome_type in [
            "Create Another Form Record",
            "Update Another Form Record",
        ]:
            source_fields = frappe.get_meta(self.engagement_form).fields
            target_fields = frappe.get_meta(self.related_form).fields
            for item in self.related_form_field_items:
                target_field = [
                    x for x in target_fields if x.fieldname == item.related_form_field
                ]
                if target_field:
                    target_field = target_field[0]
                    if item.source == "Specific Value":
                        # validate absolute values
                        self._do_validate_update_value(
                            target_field, item.update_value, item.idx
                        )
                    elif item.source == "From Current Form Field":
                        # validate source and target values
                        source_field = [
                            x
                            for x in source_fields
                            if x.fieldname == item.current_form_field
                        ]
                        if source_field:
                            source_field = source_field[0]
                            self._do_validate_source_to_target_fields(
                                source_field, target_field, item.idx
                            )
                        elif (
                            item.current_form_field == "name"
                        ):  # name (ID) field will not be part of the meta.fields
                            self._do_validate_source_to_target_fields(
                                "name", target_field, item.idx
                            )

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

                # for date, check for Today and Now
                if fieldtype in ["Date", "Datetime"] and str(value).lower() in [
                    "today",
                    "now",
                ]:
                    value = now()

                # for time Check for Now
                if fieldtype in ["Time"] and str(value).lower() == "now":
                    value = nowtime()

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

            self.communicate(doc)
        except Exception as e:
            self.log_error("Failed to trigger notification")

    def communicate(self, doc):
        context = get_context(doc)
        try:
            if self.channel == "Email":
                self.send_an_email(doc, context)

            # if self.channel == "Slack":
            #     self.send_a_slack_msg(doc, context)

            # if self.channel == "SMS":
            #     self.send_sms(doc, context)

            if self.channel == "System Notification" or self.send_system_notification:
                self.create_system_notification(doc, context)

        except Exception:
            self.log_error("Failed to send Notification")

    def send_an_email(self, doc, context):
        from email.utils import formataddr
        from frappe.core.doctype.communication.email import _make as make_communication

        subject = self.subject

        if "{" in subject:
            subject = frappe.render_template(self.subject, context)

        attachments = self.get_attachment(doc)
        recipients, cc, bcc = self.get_list_of_recipients(doc, context)
        if not (recipients or cc or bcc):
            return

        sender = None
        message = frappe.render_template(self.message, context)
        if self.sender and self.sender_email:
            sender = formataddr((self.sender, self.sender_email))

        # recipients = [x for x in recipients if x == "stevenyaga@gmail.com"]
        communication = None
        # Add mail notification to communication list
        # No need to add if it is already a communication.
        if doc.doctype != "Communication":
            communication = make_communication(
                doctype=get_reference_doctype(doc),
                name=get_reference_name(doc),
                content=message,
                subject=subject,
                sender=sender,
                recipients=recipients,
                communication_medium="Email",
                send_email=False,
                attachments=attachments,
                cc=cc,
                bcc=bcc,
                communication_type="Automated Message",
            ).get("name")

        frappe.sendmail(
            recipients=recipients,
            subject=subject,
            sender=sender,
            cc=cc,
            bcc=bcc,
            message=message,
            reference_doctype=get_reference_doctype(doc),
            reference_name=get_reference_name(doc),
            attachments=attachments,
            expose_recipients="header",
            print_letterhead=(
                (attachments and attachments[0].get("print_letterhead")) or False
            ),
            communication=communication,
        )

    def get_attachment(self, doc):
        """Check print settings and attach the pdf"""
        if not self.attach_print:
            return None

        print_settings = frappe.get_doc("Print Settings", "Print Settings")
        if (doc.docstatus == 0 and not print_settings.allow_print_for_draft) or (
            doc.docstatus == 2 and not print_settings.allow_print_for_cancelled
        ):
            # ignoring attachment as draft and cancelled documents are not allowed to print
            status = "Draft" if doc.docstatus == 0 else "Cancelled"
            frappe.throw(
                _(
                    """Not allowed to attach {0}. Please enable Allow Print For {0} in Print Settings""",
                ).format(status),
                title=_("Error in Engage Alert"),
            )
        else:
            return [
                {
                    "print_format_attachment": 1,
                    "doctype": doc.doctype,
                    "name": doc.name,
                    "print_format": self.print_format,
                    "print_letterhead": print_settings.with_letterhead,
                    "lang": (
                        frappe.db.get_value(
                            "Print Format", self.print_format, "default_print_language"
                        )
                        if self.print_format
                        else "en"
                    ),
                }
            ]

    def create_system_notification(self, doc, context):
        subject = self.subject
        if "{" in subject:
            subject = frappe.render_template(self.subject, context)

        attachments = self.get_attachment(doc)

        recipients, cc, bcc = self.get_list_of_recipients(doc, context)

        users = recipients + cc + bcc

        if not users:
            return

        notification_doc = {
            "type": "Alert",
            "document_type": get_reference_doctype(doc),
            "document_name": get_reference_name(doc),
            "subject": subject,
            "from_user": doc.modified_by or doc.owner,
            "email_content": frappe.render_template(self.message, context),
            "attached_file": attachments and json.dumps(attachments[0]),
        }
        enqueue_create_notification(users, notification_doc)

    def get_list_of_recipients(self, doc, context):
        recipients = []
        cc = []
        bcc = []
        for recipient in self.recipients:
            if recipient.condition:
                if not frappe.safe_eval(recipient.condition, None, context):
                    continue
            if recipient.receiver_by_document_field:
                fields = recipient.receiver_by_document_field.split(",")
                # fields from child table
                if len(fields) > 1:
                    for d in doc.get(fields[1]):
                        email_id = d.get(fields[0])
                        if validate_email_address(email_id):
                            recipients.append(email_id)
                # field from parent doc
                else:
                    email_ids_value = doc.get(fields[0])
                    if validate_email_address(email_ids_value):
                        email_ids = email_ids_value.replace(",", "\n")
                        recipients = recipients + email_ids.split("\n")

            cc.extend(get_emails_from_template(recipient.cc, context))
            bcc.extend(get_emails_from_template(recipient.bcc, context))

            # For sending emails to specified role
            if recipient.receiver_by_role:
                emails = get_info_based_on_role(
                    recipient.receiver_by_role, "email", ignore_permissions=True
                )

                for email in emails:
                    recipients = recipients + email.split("\n")

        # if self.send_to_all_assignees:
        # 	recipients = recipients + get_assignees(doc)

        return list(set(recipients)), list(set(cc)), list(set(bcc))

    # def get_receiver_list(self, doc, context):
    # 	"""return receiver list based on the doc field and role specified"""
    # 	receiver_list = []
    # 	for recipient in self.recipients:
    # 		if recipient.condition:
    # 			if not frappe.safe_eval(recipient.condition, None, context):
    # 				continue

    # 		# For sending messages to the owner's mobile phone number
    # 		if recipient.receiver_by_document_field == "owner":
    # 			receiver_list += get_user_info([dict(user_name=doc.get("owner"))], "mobile_no")
    # 		# For sending messages to the number specified in the receiver field
    # 		elif recipient.receiver_by_document_field:
    # 			receiver_list.append(doc.get(recipient.receiver_by_document_field))

    # 		# For sending messages to specified role
    # 		if recipient.receiver_by_role:
    # 			receiver_list += get_info_based_on_role(
    # 				recipient.receiver_by_role, "mobile_no", ignore_permissions=True
    # 			)

    # 	return receiver_list

    # def send_sms(self, doc, context):
    # 	send_sms(
    # 		receiver_list=self.get_receiver_list(doc, context),
    # 		msg=frappe.render_template(self.message, context),
    # 	)


def get_emails_from_template(template, context):
    if not template:
        return ()

    emails = frappe.render_template(template, context) if "{" in template else template
    return filter(None, emails.replace(",", "\n").split("\n"))


def get_reference_doctype(doc):
    return doc.parenttype if doc.meta.istable else doc.doctype


def get_reference_name(doc):
    return doc.parent if doc.meta.istable else doc.name
