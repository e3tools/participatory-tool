import frappe
from frappe.utils import flt, cint


def evaluate_formula(formula_tokens, row_data=None, doctype=None, target_field=None):
    """
    formula_tokens: Parsed list or string representation of the expression
    row_data: Dictionary of current field values (from the form or child table row)
    Evaluates the formula tokens with automatic normalization for null/empty values.

    Evaluates formula tokens. If row_data is empty or missing values,
    it automatically constructs a mock context for dry-run validation.
    """
    try:
        if isinstance(formula_tokens, str):
            formula_tokens = frappe.parse_json(formula_tokens)

        if not formula_tokens:
            return {
                "status": "Success",
                "result": 0.0,
                "is_dry_run": False,
                "formula": None,
            }

        row_data = frappe.parse_json(row_data) if row_data else {}

        # 1. Fetch Field Meta Types from Child Table Definition
        field_types = {}
        if doctype:
            meta = frappe.get_meta(doctype)
            for f in meta.fields:
                if f.fieldtype in ["Float", "Int", "Currency", "Percent"]:
                    field_types[f.fieldname] = "numeric"
                elif f.fieldtype in [
                    "Data",
                    "Text",
                    "Small Text",
                    "Long Text",
                    "Link",
                    "Select",
                ]:
                    field_types[f.fieldname] = "string"
                else:
                    field_types[f.fieldname] = "other"

        # Identify all fields referenced in the formula tokens
        referenced_fields = [
            t.get("value") for t in formula_tokens if t.get("type") == "field"
        ]

        # CIRCULAR DEPENDENCY CHECK
        if target_field and target_field in referenced_fields:
            return {
                "status": "error",
                "message": f"Circular Dependency Error: The target field ('{target_field}') cannot reference itself in its own formula.",
            }

        # 2. Build evaluation context & inject safe helper functions ('flt').  (combining real data with mock defaults)
        evaluation_context = {"flt": flt, "cint": cint, "round": round, "abs": abs}

        is_dry_run = False

        for field in referenced_fields:
            val = row_data.get(field)
            if val is None or val == "":
                # Data is missing/empty -> Use safe mock value (1.0 prevents division-by-zero errors during testing)
                evaluation_context[field] = 1.0
                is_dry_run = True
            else:
                evaluation_context[field] = val

        # Include any other fields present in row_data just in case
        # Doing this will cause the is_safe_expression method to return false. so disable it
        # for key, val in row_data.items():
        #     if key not in evaluation_context:
        #         evaluation_context[key] = flt(val) if val not in [None, ""] else 0.0

        # Build expression string with safe flt wrappers
        expression_parts = []
        for t in formula_tokens:
            if t.get("type") == "field":
                expression_parts.append(f"flt({t.get('value')})")
            else:
                expression_parts.append(str(t.get("value")))

        expression = " ".join(expression_parts)

        # Security validation check
        allowed_fields = list(evaluation_context.keys())
        is_safe, error_msg = validate_expression_safety_and_types(
            expression, allowed_fields, field_types
        )
        if not is_safe:
            return {
                "status": "error",
                "message": error_msg,  # "Unsafe or unauthorized expression elements detected.",
            }

        # 5. Safe Evaluation
        result = frappe.safe_eval(expression, eval_locals=evaluation_context)

        return {
            "status": "success",
            "result": result,
            "is_dry_run": is_dry_run,
            "message": (
                "Formula is syntactically valid (tested with mock data)."
                if is_dry_run
                else "Success"
            ),
            "formula": compile_formula_to_server_script(
                formula_tokens=formula_tokens,
                target_fieldname="",
                field_types=field_types,
            ),
        }
    except ZeroDivisionError:
        return {
            "status": "error",
            "message": "Mathematical Error: Division by zero detected in expression.",
        }
    except Exception as e:
        frappe.log_error(
            title="Formula Evaluation Error", message=frappe.get_traceback()
        )
        # return {"status": "error", "message": str(e)}
        return {"status": "error", "message": f"Syntax Error: {str(e)}"}


def validate_expression_safety_and_types(expression, allowed_fields, field_types):
    """
     Explicitly disallows all function calls (ast.Call)

    wraps field names in the flt(...) function to safely handle null values
    It still strictly blocks dangerous operations like imports (__import__), attribute traversal (os.system), and lambda expressions
    """
    import ast

    ALLOWED_FUNCTIONS = {"flt", "cint", "str", "abs", "round", "min", "max"}

    try:
        tree = ast.parse(expression, mode="eval")

        for node in ast.walk(tree):
            # Check Security Constraints
            if isinstance(node, ast.Name):
                if node.id not in allowed_fields and node.id not in ALLOWED_FUNCTIONS:
                    return False, f"Unauthorized variable or field: '{node.id}'"
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id not in ALLOWED_FUNCTIONS:
                        return False, f"Unauthorized function call: '{node.func.id}'"
                else:
                    return False, "Invalid function call structure."
            elif isinstance(node, (ast.Import, ast.Attribute, ast.Lambda)):
                return False, "Unsafe expression pattern detected."

            # Check Data Type Consistency for Arithmetic Operations (+, -, *, /)
            elif isinstance(node, ast.BinOp):
                if isinstance(
                    node.op,
                    (
                        ast.Add,
                        ast.Sub,
                        ast.Mult,
                        ast.Div,
                        ast.FloorDiv,
                        ast.Mod,
                        ast.Pow,
                    ),
                ):
                    left_type = get_node_data_type(node.left, field_types)
                    right_type = get_node_data_type(node.right, field_types)

                    # If we are mixing a known string field with numeric arithmetic
                    if (left_type == "string" and right_type == "numeric") or (
                        left_type == "numeric" and right_type == "string"
                    ):
                        return (
                            False,
                            "Type Mismatch Error: Cannot perform arithmetic operations between a text field and a numeric field.",
                        )

        return True, ""
    except SyntaxError:
        return False, "Syntax Error in formula structure."


def get_node_data_type(node, field_types):
    import ast

    # Unwrap flt(...) wrappers to check the inner field type
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "flt"
    ):
        if node.args and isinstance(node.args[0], ast.Name):
            fieldname = node.args[0].id
            return field_types.get(fieldname, "numeric")

    if isinstance(node, ast.Name):
        return field_types.get(node.id, "unknown")
    elif isinstance(node, ast.Constant):  # Python 3.8+
        if isinstance(node.value, (int, float)):
            return "numeric"
        elif isinstance(node.value, str):
            return "string"
    return "unknown"


def is_safe_expression(expression, allowed_fields):
    """
    Explicitly disallows all function calls (ast.Call)

    wraps field names in the flt(...) function to safely handle null values
    It still strictly blocks dangerous operations like imports (__import__), attribute traversal (os.system), and lambda expressions
    """
    import ast

    # Define safe built-in casting and math functions permitted in formulas
    ALLOWED_FUNCTIONS = {"flt", "int", "str", "abs", "round", "min", "max"}

    try:
        tree = ast.parse(expression, mode="eval")
        for node in ast.walk(tree):
            if isinstance(node, ast.Name):
                # Allow referenced fields and permitted safe functions
                if node.id not in allowed_fields and node.id not in ALLOWED_FUNCTIONS:
                    return False
            elif isinstance(node, ast.Call):
                # Allow function calls ONLY if the function name is in our safe list
                if isinstance(node.func, ast.Name):
                    if node.func.id not in ALLOWED_FUNCTIONS:
                        return False
                else:
                    return False
            elif isinstance(node, (ast.Import, ast.Attribute, ast.Lambda)):
                # Strictly block imports, attribute lookups, and lambdas
                return False
        return True
    except SyntaxError:
        return False


def compile_formula_to_server_script(
    formula_tokens, target_fieldname, field_types=None
):
    """
    Converts a token array into a clean Python assignment string for Server Scripts.
    Example: doc.total = (doc.male or 0) + (doc.female or 0)
    """
    if isinstance(formula_tokens, str):
        formula_tokens = frappe.parse_json(formula_tokens)

    if not formula_tokens:
        return ""  # return f"doc.{target_fieldname} = 0"

    field_types = field_types or {}
    expression_parts = []

    for t in formula_tokens:
        token_type = t.get("type")
        token_val = t.get("value")

        if token_type == "field":
            # Determine default fallback based on field type
            ftype = field_types.get(token_val, "numeric")
            fallback = "''" if ftype == "string" else "0"

            # Wrap field in null-coalescing fallback: (doc.fieldname or 0)
            expression_parts.append(f"(doc.{token_val} or {fallback})")
        else:
            # Operators (+, -, *, /, etc.) and numbers
            expression_parts.append(str(token_val))

    expression_body = " " + " ".join(expression_parts)
    return f"{expression_body}"  #  f"doc.{target_fieldname} ={expression_body}"
