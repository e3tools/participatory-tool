import frappe
from participatory_backend.enums import TechnicalAnalysisTypeEnum
from frappe import _
import re
from frappe.desk.form.load import get_docinfo, getdoc, getdoctype


def get_technical_analysis_type(data_type):
    mp = {
        "Float": TechnicalAnalysisTypeEnum.NUMERIC.value,
        "Integer": TechnicalAnalysisTypeEnum.NUMERIC.value,
        "String": TechnicalAnalysisTypeEnum.TEXT.value,
        "Date": TechnicalAnalysisTypeEnum.DATE.value,
    }
    if data_type in mp:
        return mp[data_type]
    frappe.throw(_(f"Data type {data_type} not mapped to an analysis type"))


def get_initials(text: str):
    """
    Get initials given a string
    """
    res = ""
    parts = text.strip().replace("  ", " ").split(" ")
    for part in parts:
        if part.isnumeric():
            res += part
        else:
            res += part[0]
    # return "".join([x[0].upper() for x in text.strip().replace("  ", " ").split(" ")])
    return res


def scrub(text: str, strip_numerics=False):
    """
    Replace special characters then call frappe.scrub
    """
    if not text:
        return ""
    # txt = '_'.join(re.findall(r'\b\w+\b', text))
    txt = strip_special_characters(text, strip_numerics).strip()
    return frappe.scrub(txt)


def strip_special_characters(text: str, strip_numerics=True):
    text = text.strip() if text else ""  # strip out the space first
    if strip_numerics:
        res = re.sub(r"[^a-zA-Z]", "_", text)  # remove anything that is not text
    else:
        res = re.sub(
            r"[^a-zA-Z0-9]", "_", text
        )  # remove anything that is not text or number
    res = re.sub(r"_+", "_", res)  # replace multiple _ with a single one
    return res.strip().strip("_")  # strip leading and trailing underscores


def is_float(value):
    try:
        float(value)
        return True
    except ValueError:
        return False


def get_child_doctypes(doctype):
    """
    Get all doctypes that are contained in a doctype as child forms
    """
    getdoctype(doctype)
    child_docs = frappe.response.docs
    return [f"{x.name}" for x in child_docs]
