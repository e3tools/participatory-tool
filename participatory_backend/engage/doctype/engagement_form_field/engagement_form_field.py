# Copyright (c) 2024, Steve Nyaga and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class EngagementFormField(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		additional_linked_table_fields: DF.JSON | None
		data_field_html: DF.TextEditor | None
		data_field_options: DF.Literal["", "Email", "Phone", "URL"]
		depends_on: DF.SmallText | None
		depends_on_plain: DF.SmallText | None
		description: DF.SmallText | None
		field_child_doctype: DF.Link | None
		field_choices: DF.SmallText | None
		field_default: DF.Data | None
		field_doctype: DF.Link | None
		field_filters: DF.Data | None
		field_filters_plain: DF.Data | None
		field_hidden: DF.Check
		field_in_list_view: DF.Check
		field_is_backend_field: DF.Check
		field_is_search_field: DF.Check
		field_label: DF.Data | None
		field_length: DF.Int
		field_linked_field: DF.Data | None
		field_name: DF.Data | None
		field_non_negative: DF.Check
		field_precision: DF.Literal["", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
		field_readonly: DF.Check
		field_reqd: DF.Check
		field_type: DF.Literal["", "Attach", "Attach Image", "Check", "Column Break", "Currency", "Data", "Date", "Datetime", "Duration", "HTML", "Int", "Float", "Geolocation", "Link", "Linked Field", "Password", "Rating", "Select", "Select Multiple", "Section Break", "Signature", "Small Text", "Text", "Text Editor", "Tab Break", "Table", "Table MultiSelect", "Time"]
		formula: DF.SmallText | None
		hide_days: DF.Check
		hide_seconds: DF.Check
		linked_form: DF.Literal[None]
		linked_form_property: DF.Literal[None]
		mandatory_depends_on: DF.SmallText | None
		mandatory_depends_on_plain: DF.SmallText | None
		max_height: DF.Data | None
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		read_only_depends_on: DF.SmallText | None
		read_only_depends_on_plain: DF.SmallText | None
	# end: auto-generated types
	pass
