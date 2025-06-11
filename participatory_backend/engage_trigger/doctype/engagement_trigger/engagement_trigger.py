# Copyright (c) 2025, Steve Nyaga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _
from frappe.utils import cast, validate_email_address
from frappe.email.doctype.notification.notification import get_context
from frappe.core.doctype.sms_settings.sms_settings import send_sms
import json
from frappe.desk.doctype.notification_log.notification_log import (
    enqueue_create_notification,
)
from frappe.core.doctype.role.role import get_info_based_on_role, get_user_info


class EngagementTrigger(Document):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF
        from participatory_backend.engage_trigger.doctype.engage_trigger_recipient_item.engage_trigger_recipient_item import EngageTriggerRecipientItem
        from participatory_backend.engage_trigger.doctype.engagement_trigger_related_form_item.engagement_trigger_related_form_item import EngagementTriggerRelatedFormItem
        from participatory_backend.engage_trigger.doctype.engagement_trigger_update_form_field_item.engagement_trigger_update_form_field_item import EngagementTriggerUpdateFormFieldItem

        activate_trigger_on: DF.Literal["", "New", "Value Change"]
        attach_print: DF.Check
        change_field: DF.Literal[None]
        channel: DF.Literal["Email", "SMS"]
        condition: DF.SmallText | None
        enabled: DF.Check
        engagement_form: DF.Link
        field_linking_forms: DF.Literal[None]
        message: DF.Code | None
        outcome_type: DF.Literal["", "Update Current Record", "Create Another Form Record", "Update Another Form Record"]
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
