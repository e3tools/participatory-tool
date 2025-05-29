# Copyright (c) 2023, Steve Nyaga and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

class Engagement(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		closing_date: DF.Date | None
		cover_image: DF.AttachImage | None
		data_forms_template: DF.Link | None
		description: DF.SmallText
		engagement_form: DF.Link | None
		engagement_name: DF.Data
		engagement_type: DF.Literal["", "Survey", "Submission", "Guestbook", "Stories", "Q&A", "Quick Poll", "Ideas", "Discussion Forum", "Map"]
		has_data_forms: DF.Check
		has_discussion_forum: DF.Check
		has_formal_submissions: DF.Check
		has_guestbook: DF.Check
		has_ideas: DF.Check
		has_map: DF.Check
		has_qa: DF.Check
		include_quick_poll: DF.Check
		is_published: DF.Check
		question: DF.Link | None
		quick_poll: DF.Link | None
		status: DF.Literal["Open", "Closed"]
	# end: auto-generated types
	ENGAGEMENT_ENTRY_FIELD = 'engagement_entry'
	ENGAGEMENT_ENTRY_STATUS_FIELD = 'engagement_entry_status'
	def validate(self):
		if cint(self.has_data_forms):
			self.create_custom_fields()

		self.validate_closing_date()

	# def on_update(self):
	# 	self.create_custom_fields()

	def create_custom_fields(self):
		self.create_custom_fields_for_engagement_form()
		# self.create_custom_fields_by_template()

	def validate_closing_date(self):
		if cint(self.is_published):
			if not self.closing_date:
				frappe.throw(_("You must specify the Closing Date of this engagement")) 

	def create_custom_fields_for_engagement_form(self):
		"""
		For the selected Engagement Form, add a field for Engagement Entry
		"""
		if self.is_published:
			self.create_custom_field_for_engagement_entry(self.engagement_form) 

	def create_custom_fields_by_template(self):
		"""
		For each doctype item, add a field for Engagement Entry
		"""
		if self.is_published:
			template = frappe.get_doc("Engagement Template", self.data_forms_template)
			for item in template.items:
				self.create_custom_field_for_engagement_entry(item.doctype_item)

	def create_custom_field_for_engagement_entry(self, document_type):
		frappe.clear_cache(doctype=document_type)
		meta = frappe.get_meta(document_type)
		if not meta.get_field(self.ENGAGEMENT_ENTRY_FIELD):
			# create custom field
			frappe.get_doc(
				{
					"doctype": "Custom Field",
					"dt": document_type,
					"__islocal": 1,
					"fieldname": self.ENGAGEMENT_ENTRY_FIELD,
					"label": self.ENGAGEMENT_ENTRY_FIELD.replace("_", " ").title(),
					"hidden": 1,
					"read_only": 1,
					"allow_on_submit": 1,
					"no_copy": 1,
					"fieldtype": "Link",
					"options": "Engagement Entry",
					"owner": "Administrator",
				}
			).save(ignore_permissions=True)

			frappe.msgprint(
				_("Created Custom Field {0} in {1}").format(self.ENGAGEMENT_ENTRY_FIELD, document_type)
			)

		if not meta.get_field(self.ENGAGEMENT_ENTRY_STATUS_FIELD):
			# create custom field
			frappe.get_doc(
				{
					"doctype": "Custom Field",
					"dt": document_type,
					"__islocal": 1,
					"fieldname": self.ENGAGEMENT_ENTRY_STATUS_FIELD,
					"label": self.ENGAGEMENT_ENTRY_STATUS_FIELD.replace("_", " ").title(),
					"hidden": 1,
					"allow_on_submit": 1,
					"readonly": 1,
					"no_copy": 1,
					"fieldtype": "Select",
					"options": "Draft\nSubmitted\nCancelled",
					"owner": "Administrator",
				}
			).save(ignore_permissions=True)

			frappe.msgprint(
				_("Created Custom Field {0} in {1}").format(self.ENGAGEMENT_ENTRY_STATUS_FIELD, document_type)
			)