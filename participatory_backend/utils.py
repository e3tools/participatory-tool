import frappe
from participatory_backend.enums import TechnicalAnalysisTypeEnum

def get_technical_analysis_type(data_type):
    mp = {
        'Float': TechnicalAnalysisTypeEnum.NUMERIC.value,
        'Integer': TechnicalAnalysisTypeEnum.NUMERIC.value,
        'String': TechnicalAnalysisTypeEnum.TEXT.value,
        'Date': TechnicalAnalysisTypeEnum.DATE.value
    }
    if data_type in mp:
        return mp[data_type]
    frappe.throw(_(f"Data type {data_type} not mapped to an analysis type"))