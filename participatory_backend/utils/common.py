import frappe
from participatory_backend.enums import TechnicalAnalysisTypeEnum
from frappe import _
import re


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


def scrub(text: str):
    """
    Replace special characters then call frappe.scrub
    """
    if not text:
        return ""
    # txt = '_'.join(re.findall(r'\b\w+\b', text))
    txt = strip_special_characters(text).strip()
    return frappe.scrub(txt)


def strip_special_characters(text: str, strip_numerics=True):
    if strip_numerics:
        res = re.sub(r"[^a-zA-Z]", "_", text)  # remove anything that is not text
    else:
        res = re.sub(
            r"[^a-zA-Z0-9]", "_", text
        )  # remove anything that is not text or number
    res = re.sub(r"_+", "_", res)  # replace multiple _ with a single one
    return res.strip()
