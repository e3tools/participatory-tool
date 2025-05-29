import frappe
import datetime
from participatory_backend.enums import EngagementStatusEnum
from frappe.desk.form.linked_with import get_linked_docs, get_linked_doctypes
from frappe.utils import cint
from frappe.client import attach_file
import base64
from PIL import Image
import io
from frappe import _
from participatory_backend.engage.doctype.engagement.engagement import Engagement

IGNORE_ENGAGEMENT_TEMPLATE = 1


def update_engagement_entry_status(engagement_entry_name, status: EngagementStatusEnum):
    """
    Discard draft records that are not completed. will set the status to CANCELLED
    """
    linked_records = get_linked_docs(
        "Engagement Entry",
        engagement_entry_name,
        linkinfo=get_linked_doctypes("Engagement Entry"),
    )
    for doctype in linked_records:
        for doc in linked_records[doctype]:
            frappe.db.set_value(
                doctype, doc.name, "engagement_entry_status", status.value
            )
    frappe.db.set_value(
        "Engagement Entry", engagement_entry_name, "status", status.value
    )


def discard_draft_engagement_entry(engagement_entry_name):
    """
    Discard draft records that are not completed. will set the status to CANCELLED
    """
    update_engagement_entry_status(
        engagement_entry_name, EngagementStatusEnum.CANCELLED
    )


def is_engagement_entry_ready_to_submit(
    engagement_entry_name, engagement_name=None, engagement_entry_doc=None
):
    """Check if all the doctypes linked with the template have data and thus ready to submit

    Args:
                                    engagement_entry_name: Name of Engagement Entry
                                    engagement_name. Name of engagement. Defaults to None.
                                    engagement_entry_record: Data entered by user against an engagement. Defaults to None.
    """
    if not engagement_name:
        engagement_name = frappe.db.get_value(
            "Engagement Entry", engagement_entry_name, "engagement_name"
        )

    if not engagement_entry_doc:
        engagement_entry_doc = get_engagement_entry_records()

    if not engagement_entry_doc:
        return False

    required_doctypes = get_engagement_doctypes(engagement_name)
    for doctype in required_doctypes:
        if (
            doctype not in engagement_entry_doc
        ):  # if doctype is missing, then it is not ready for submit
            return False
    return True


def get_backend_only_fields(engagement_form_name: str):
    """
    Get backend only fields. This approach was taken instead of customizing DocField since DocField is a restricted DocType that cannot be customized
    """
    if engagement_form_name:
        # check if there is a matching Engagement Form
        if frappe.db.exists("Engagement Form", {"name": engagement_form_name}):
            engagement_form_fields = frappe.get_doc(
                "Engagement Form", engagement_form_name
            ).form_fields
            backend_fields = [
                y for y in engagement_form_fields if y.field_is_backend_field
            ]
            return backend_fields
    return []


def get_engagement_doctypes(engagement_name):
    """Get doctypes that are required to capture data related to an engagement

    Args:
                                    engagement_name: Name of the engagement
    """
    doctypes = []
    # get the engagement
    engagement = frappe.get_doc("Engagement", engagement_name)
    if cint(engagement.has_data_forms):
        # get the template
        if IGNORE_ENGAGEMENT_TEMPLATE:
            doctypes = [engagement.engagement_form]
        else:
            template = frappe.get_doc(
                "Engagement Template", engagement.data_forms_template
            )
            doctypes = [x.doctype_item for x in template.items]
    return doctypes


def save_engagement_entry():
    """
    Save engagement entry
    The object has DocType as the keys
    """

    def save_doctype_entry(doctype, entry):

        def save_files():

            def _upload_file(file_entry: dict):
                """Save/upload file

                Args:
                                                file_entry (dict): The uploaded file
                """
                file_url = None
                content = frappe.safe_decode(base64.b64decode(file_entry["base64"]))
                # img = Image.open(io.BytesIO(content))
                file_name = (
                    file_entry.get("file_name") or file_entry.get("uri").split("/")[-1]
                )
                if is_new_record:
                    new_file = frappe.get_doc(
                        {
                            "doctype": "File",
                            "file_name": file_name,
                            "content": content,
                            "is_private": 1,
                        }
                    )
                    fl = new_file.insert()
                    file_url = fl.file_url
                else:
                    new_file = frappe.get_doc(
                        {
                            "doctype": "File",
                            "file_name": file_name,
                            "content": content,
                            "is_private": 1,
                        }
                    )
                    fl = new_file.insert()
                    file_url = fl.file_url

                return file_url

            def _process_file_fields(file_fields, doc):
                """
                Save/upload files for all field types (Attach/Attach Image) present in a doc
                """
                for field in file_fields:
                    urls = []
                    uploaded_files = doc.get(field.fieldname)
                    doc[field.fieldname] = None  # reset the file url
                    if uploaded_files:
                        if isinstance(uploaded_files, list):
                            for file in uploaded_files:
                                urls.append(_upload_file(file_entry=file))
                        elif isinstance(uploaded_files, str):
                            # If there is no reupload, the value will be a url. check if the file has changed
                            urls.append(uploaded_files)

                        # set file_urls as the value of the attach fields
                        doc[field.fieldname] = "\n".join(urls)

            # upload files for parent, in case there are child tables, upload later
            file_fields = [
                x
                for x in frappe.get_meta(doctype).fields
                if x.fieldtype in ["Attach", "Attach Image"]
            ]
            # attach_fields = doc.meta.get("fields", {"fieldtype": ["in", ["Attach", "Attach Image"]]})
            # process for parent doc
            _process_file_fields(file_fields=file_fields, doc=entry)

            # check if there are child table with file fields
            child_tables = [
                x for x in frappe.get_meta(doctype).fields if x.fieldtype in ["Table"]
            ]
            for table in child_tables:
                child_table_file_fields = [
                    x
                    for x in frappe.get_meta(table.options).fields
                    if x.fieldtype in ["Attach", "Attach Image"]
                ]

                # get the various child table items
                child_docs = entry.get(table.fieldname) or []
                for child_doc in child_docs:
                    _process_file_fields(
                        file_fields=child_table_file_fields, doc=child_doc
                    )

        # entry['engagement_entry'] = engagement_entry.name
        # entry['engagement_name'] = engagement_entry.status
        name_field = "docname"
        name = None
        is_new_record = False
        if name_field in entry and entry[name_field] != None:
            name = entry[name_field]
            doc = frappe.get_doc(doctype, entry[name_field])
        else:
            doc = frappe.new_doc(doctype)
            is_new_record = True

        backend_only_fields = get_backend_only_fields(doctype)
        save_files()
        entry["name"] = name
        doc.update(entry)
        doc.engagement_entry = engagement_entry.name
        doc.engagement_entry_status = engagement_entry.status
        doc.flags.ignore_mandatory = True if backend_only_fields else False
        doc.flags.ignore_permissions = True
        doc.save(
            ignore_permissions=True
        )  # if entry.name else doc.insert(ignore_permissions=True)

    data = frappe.form_dict.entry
    engagement_name = (
        data["Engagement"]["name"]
        if isinstance(data["Engagement"], object)
        else data["Engagement"]
    )
    engagement = frappe.get_doc("Engagement", engagement_name)

    engagement.create_custom_fields()  # IF has forms, create custom fields

    engagement_entry = None
    engagement_entry_name = None
    if "Engagement Entry" in data:
        engagement_entry_name = (
            data["Engagement Entry"]["name"]
            if isinstance(data["Engagement Entry"], object)
            else data["Engagement Entry"]
        )
    if "Engagement Entry" in data:  # is an edit
        engagement_entry = frappe.get_doc("Engagement Entry", engagement_entry_name)
    else:  # is a first time entry
        engagement_entry = frappe.new_doc("Engagement Entry")
        rec = {
            "doctype": "Engagement Entry",
            "engagement": engagement.name,
            "engagement_name": engagement.engagement_name,
            "entered_by": frappe.session.user,
            "entered_on": datetime.datetime.now(),
            "status": EngagementStatusEnum.DRAFT.value,
        }
        engagement_entry.update(rec)
    engagement_entry.save(ignore_permissions=True)

    submit = is_engagement_entry_ready_to_submit(
        engagement_entry_name=engagement_entry.name,
        engagement_name=engagement.name,
        engagement_entry_doc=data,
    )
    if submit:
        engagement_entry.status = EngagementStatusEnum.SUBMITTED.value
        engagement_entry.save(ignore_permissions=True)

    saved_doctypes = 0
    for doctype in data:
        if doctype not in ["Engagement", "Engagement Entry"]:
            save_doctype_entry(doctype, data[doctype])
            saved_doctypes += 1
    if saved_doctypes == 0:
        frappe.throw(_("Form data was not submitted"))
    return engagement_entry.name


def save_engagement_entry_v2():
    """
    Save engagement entry
    Data comes in as an array with items being of the form

    id: { type: 'string' },
    name: { type: 'string' },
    engagement: { type: 'string' },
    engagement_form: { type: 'string' },
    responseJson: { type: 'string' },
    isSynced: { type: 'boolean' },
    createdBy: { type: 'string' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },

    """

    def save_doctype_entry(doctype, entry):

        def save_files():

            def _upload_file(file_entry: dict):
                """Save/upload file

                Args:
                                                file_entry (dict): The uploaded file
                """
                file_url = None
                content = frappe.safe_decode(base64.b64decode(file_entry["base64"]))
                # img = Image.open(io.BytesIO(content))
                file_name = (
                    file_entry.get("file_name") or file_entry.get("uri").split("/")[-1]
                )
                if is_new_record:
                    new_file = frappe.get_doc(
                        {
                            "doctype": "File",
                            "file_name": file_name,
                            "content": content,
                            "is_private": 1,
                        }
                    )
                    fl = new_file.insert()
                    file_url = fl.file_url
                else:
                    new_file = frappe.get_doc(
                        {
                            "doctype": "File",
                            "file_name": file_name,
                            "content": content,
                            "is_private": 1,
                        }
                    )
                    fl = new_file.insert()
                    file_url = fl.file_url

                return file_url

            def _process_file_fields(file_fields, doc):
                """
                Save/upload files for all field types (Attach/Attach Image) present in a doc
                """
                for field in file_fields:
                    urls = []
                    uploaded_files = doc.get(field.fieldname)
                    doc[field.fieldname] = None  # reset the file url
                    if uploaded_files:
                        if isinstance(uploaded_files, list):
                            for file in uploaded_files:
                                urls.append(_upload_file(file_entry=file))
                        elif isinstance(uploaded_files, str):
                            # If there is no reupload, the value will be a url. check if the file has changed
                            urls.append(uploaded_files)

                        # set file_urls as the value of the attach fields
                        doc[field.fieldname] = "\n".join(urls)

            # upload files for parent, in case there are child tables, upload later
            file_fields = [
                x
                for x in frappe.get_meta(doctype).fields
                if x.fieldtype in ["Attach", "Attach Image"]
            ]
            # attach_fields = doc.meta.get("fields", {"fieldtype": ["in", ["Attach", "Attach Image"]]})
            # process for parent doc
            _process_file_fields(file_fields=file_fields, doc=entry)

            # check if there are child table with file fields
            child_tables = [
                x for x in frappe.get_meta(doctype).fields if x.fieldtype in ["Table"]
            ]
            for table in child_tables:
                child_table_file_fields = [
                    x
                    for x in frappe.get_meta(table.options).fields
                    if x.fieldtype in ["Attach", "Attach Image"]
                ]

                # get the various child table items
                child_docs = entry.get(table.fieldname) or []
                for child_doc in child_docs:
                    _process_file_fields(
                        file_fields=child_table_file_fields, doc=child_doc
                    )

        # entry['engagement_entry'] = engagement_entry.name
        # entry['engagement_name'] = engagement_entry.status
        name_field = "docname"
        name = None
        is_new_record = False
        if name_field in entry and entry[name_field] != None:
            name = entry[name_field]
            doc = frappe.get_doc(doctype, entry[name_field])
        else:
            doc = frappe.new_doc(doctype)
            is_new_record = True

        backend_only_fields = get_backend_only_fields(doctype)
        save_files()
        entry["name"] = name
        doc.update(entry["responseJson"])
        doc.engagement_entry = engagement_entry.name
        doc.engagement_entry_status = engagement_entry.status
        doc.flags.ignore_mandatory = True if backend_only_fields else False
        doc.flags.ignore_permissions = True
        doc.save(
            ignore_permissions=True
        )  # if entry.name else doc.insert(ignore_permissions=True)

    def _save_engagement_entry(submission):
        engagement_name = (
            submission["engagement"]
            if isinstance(submission["engagement"], str)
            else submission["engagement"]["name"]
        )

        engagement = frappe.get_doc("Engagement", engagement_name)

        engagement.create_custom_fields()  # IF has forms, create custom fields

        engagement_entry = None
        engagement_entry_name = None
        if "Engagement Entry" in submission:
            engagement_entry_name = (
                submission["Engagement Entry"]["name"]
                if isinstance(submission["Engagement Entry"], object)
                else submission["Engagement Entry"]
            )
        if "Engagement Entry" in submission:  # is an edit
            engagement_entry = frappe.get_doc("Engagement Entry", engagement_entry_name)
        else:  # is a first time entry
            engagement_entry = frappe.new_doc("Engagement Entry")
            rec = {
                "doctype": "Engagement Entry",
                "engagement": engagement.name,
                "engagement_name": engagement.engagement_name,
                "entered_by": frappe.session.user,
                "entered_on": datetime.datetime.now(),
                "status": EngagementStatusEnum.SUBMITTED.value,  # EngagementStatusEnum.DRAFT.value,
                "client_entry_id": submission["id"],
            }
            engagement_entry.update(rec)
        return engagement_entry.save(ignore_permissions=True)

    data = frappe.form_dict.docs

    # engagement_name = (
    # 	data["engagement"]["name"]
    # 	if isinstance(data["engagement"], object)
    # 	else data["engagement"]
    # )
    # engagement = frappe.get_doc("Engagement", engagement_name)

    # engagement.create_custom_fields()  # IF has forms, create custom fields

    # engagement_entry = None
    # engagement_entry_name = None
    # if "Engagement Entry" in data:
    # 	engagement_entry_name = (
    # 		data["Engagement Entry"]["name"]
    # 		if isinstance(data["Engagement Entry"], object)
    # 		else data["Engagement Entry"]
    # 	)
    # if "Engagement Entry" in data:  # is an edit
    # 	engagement_entry = frappe.get_doc("Engagement Entry", engagement_entry_name)
    # else:  # is a first time entry
    # 	engagement_entry = frappe.new_doc("Engagement Entry")
    # 	rec = {
    # 		"doctype": "Engagement Entry",
    # 		"engagement": engagement.name,
    # 		"engagement_name": engagement.engagement_name,
    # 		"entered_by": frappe.session.user,
    # 		"entered_on": datetime.datetime.now(),
    # 		"status": EngagementStatusEnum.DRAFT.value,
    # 	}
    # 	engagement_entry.update(rec)
    # engagement_entry.save(ignore_permissions=True)

    # submit = is_engagement_entry_ready_to_submit(
    #     engagement_entry_name=engagement_entry.name,
    #     engagement_name=engagement.name,
    #     engagement_entry_doc=data,
    # )
    # if submit:
    #     engagement_entry.status = EngagementStatusEnum.SUBMITTED.value
    #     engagement_entry.save(ignore_permissions=True)

    saved_doctypes = 0
    doctype_ids = []
    engagement_entry = None
    for rec in data:
        # check if record has been submitted earlier
        exists = frappe.db.exists("Engagement Entry", {"client_entry_id": rec["id"]})
        if (
            exists
        ):  # mark it as a success so the record can be cleared from the mobile app storage
            saved_doctypes += 1
            doctype_ids.append(rec["id"])
            continue

        engagement_entry = _save_engagement_entry(rec)
        # if doctype not in ['Engagement', 'Engagement Entry']:
        save_doctype_entry(rec["engagement_form"], rec)
        saved_doctypes += 1
        doctype_ids.append(rec["id"])
    if saved_doctypes == 0:
        frappe.throw(_("Form data was not submitted"))
    # return engagement_entry.name, doctype_ids
    return doctype_ids


def get_engagement_entry_records(engagement_entry_name):
    """
    Get all records associated with an engagement entry
    """
    record_mp = {}
    engagement_entry = frappe.db.exists("Engagement Entry", engagement_entry_name)
    if engagement_entry:
        # get engagement entry
        entry = frappe.get_doc("Engagement Entry", engagement_entry)
        record_mp["Engagement Entry"] = entry.as_dict()
        # get the engagement
        engagement = frappe.get_doc("Engagement", entry.engagement)
        if engagement.has_data_forms:
            # get the template
            template = frappe.get_doc(
                "Engagement Template", engagement.data_forms_template
            )
            # get doctypes making up the template
            for item in template.items:
                exists = frappe.db.exists(
                    item.doctype_item, {"engagement_entry": engagement_entry}
                )
                if exists:
                    record_mp[item.doctype_item] = frappe.get_doc(
                        item.doctype_item, exists
                    ).as_dict()
    return record_mp


def get_active_engagements() -> list[Engagement]:
    engagements = frappe.db.get_list(
        "Engagement",
        filters={"is_published": 1, "closing_date": [">=", datetime.datetime.today()]},
        fields="*",
        ignore_permissions=True,
    )
    return engagements
