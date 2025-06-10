import frappe
from frappe import _
import datetime


def before_save_shape_file(shape_file, method):
    # check that admin level fields refer to existing attributes
    attribs = [x.attribute for x in shape_file.field_mappings]
    if shape_file.custom_county_field and shape_file.custom_county_field not in attribs:
        frappe.throw(
            _(
                f"The attribute [{frappe.bold(shape_file.custom_county_field)}] specified for County field does not exist"
            )
        )
    if (
        shape_file.custom_sub_county_field
        and shape_file.custom_sub_county_field not in attribs
    ):
        frappe.throw(
            _(
                f"The attribute [{frappe.bold(shape_file.custom_sub_county_field)}] specified for Sub-County field does not exist"
            )
        )
    if shape_file.custom_ward_field and shape_file.custom_ward_field not in attribs:
        frappe.throw(
            _(
                f"The attribute [{frappe.bold(shape_file.custom_ward_field)}] specified for Ward field does not exist"
            )
        )
