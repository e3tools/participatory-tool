import io
import json
import frappe
import requests
from frappe.custom.doctype.custom_field.custom_field import create_custom_field
import matplotlib

matplotlib.use("Agg")  # Run in headless mode for server environments
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon, Circle
from enum import Enum
import geopandas as gpd
from shapely.geometry import shape
import contextily as ctx


class MapStyleEnum(Enum):
    OPEN_STREET_MAP = "OpenStreetMap"
    CARTODB_POSITRON = "CartoDB Positron"
    CARTODB_DARKMATTER = "CartoDB DarkMatter"


def handle_geolocation_image(doc, method):
    # Skip for single doctypes or new unsaved docs without names if needed,
    # but before_save runs fine. Note: file attachments require doc.name to exist.
    if not doc.name:
        return

    # 1. Handle Parent Document Geolocation fields
    process_geolocation_fields(doc, doc.doctype)

    # 2. Handle Child Tables
    meta = frappe.get_meta(doc.doctype)
    table_fields = [
        field.fieldname for field in meta.fields if field.fieldtype == "Table"
    ]

    for table_fieldname in table_fields:
        child_rows = doc.get(table_fieldname)
        if not child_rows:
            continue

        child_doctype = meta.get_field(table_fieldname).options

        for row in child_rows:
            # Ensure child row has a name (saved in DB or generated in-memory)
            if not row.get("name"):
                continue
            process_geolocation_fields(row, child_doctype, parent_doc=doc)


def process_geolocation_fields(target_doc, doctype, parent_doc=None):
    """Processes Geolocation fields for either a parent or child row document."""
    meta = frappe.get_meta(doctype)

    # Find all Geolocation fields in the DocType
    geolocation_fields = [
        field.fieldname for field in meta.fields if field.fieldtype == "Geolocation"
    ]
    for geo_field in geolocation_fields:
        geo_value = target_doc.get(geo_field)

        target_field = f"{geo_field}_image"
        existing_file_url = target_doc.get(target_field)

        # If the geolocation field is now empty, clear the image field and delete the old file
        if not geo_value:
            if existing_file_url:
                delete_existing_file(existing_file_url)
                target_doc.set(target_field, None)
            continue

        # Dynamically create hidden Attach Image field if it doesn't exist on this DocType
        if not frappe.db.exists(
            "Custom Field", {"dt": doctype, "fieldname": target_field}
        ):
            create_custom_field(
                doctype,
                {
                    "fieldname": target_field,
                    "label": f"{meta.get_field(geo_field).label} Map Image",
                    "fieldtype": "Attach Image",
                    "hidden": 1,
                    "read_only": 1,
                    "insert_after": geo_field,
                },
            )
            frappe.clear_cache(doctype=doctype)

        USE_EXTERNAL_API = False
        image_content = None

        try:
            geo_data = (
                json.loads(geo_value) if isinstance(geo_value, str) else geo_value
            )

            if USE_EXTERNAL_API:
                coords = extract_coordinates(geo_data)
                if not coords:
                    continue

                lat, lng = coords

                # Generate or fetch map image
                image_url = f"https://static-map-api-example.com/render?lat={lat}&lon={lng}&zoom=14&size=600x400"
                response = requests.get(image_url, timeout=10)
                if response.status_code == 200:
                    image_content = response.content
            else:
                image_content = render_geometry_to_image(geo_data)

            # 1. Clean up old image if it exists before saving the new one
            if existing_file_url:
                delete_existing_file(existing_file_url)

            if image_content:
                # If it's a child row, attach to the parent doc or child row name
                ref_name = target_doc.name

                file_doc = frappe.get_doc(
                    {
                        "doctype": "File",
                        "file_name": f"{doctype}_{target_doc.name}_{geo_field}.png",
                        "attached_to_doctype": doctype,
                        "attached_to_name": ref_name,
                        "content": image_content,
                        "is_private": 0,
                    }
                )
                file_doc.save(ignore_permissions=True)

                target_doc.set(target_field, file_doc.file_url)

        except Exception as e:
            frappe.log_error(
                title=f"Geolocation Image Error ({doctype})", message=str(e)
            )


def delete_existing_file(file_url):
    """Deletes the old File document and its underlying storage file."""
    try:
        old_file_name = frappe.db.get_value("File", {"file_url": file_url}, "name")
        if old_file_name:
            frappe.delete_doc(
                "File", old_file_name, ignore_permissions=True, force=True
            )
    except Exception as e:
        frappe.log_error(
            title="Failed to Delete Old Geolocation Image File", message=str(e)
        )


def render_geometry_to_image(geo_data, map_style=MapStyleEnum.OPEN_STREET_MAP):
    """
    Renders mixed FeatureCollections containing Polygons, LineStrings, and Points into a single image.
    Renders Points, LineStrings, and Polygons locally into image bytes using Matplotlib.
    Renders mixed FeatureCollections containing Polygons, LineStrings, and Points into a single image.
    Aggregate all coordinates across all features so the map canvas can calculate a unified bounding box that frames everything together.
    """
    try:
        if isinstance(geo_data, str):
            geo_data = json.loads(geo_data)

        fig, ax = plt.subplots(figsize=(6, 4), dpi=100)
        ax.set_aspect("equal")
        ax.set_facecolor("#f4f4f4")

        all_lngs = []
        all_lats = []

        # Normalize input to a list of features
        features = []
        if isinstance(geo_data, dict):
            if geo_data.get("type") == "FeatureCollection":
                features = geo_data.get("features", [])
            elif geo_data.get("type") == "Feature":
                features = [geo_data]
            else:
                features = [{"type": "Feature", "geometry": geo_data, "properties": {}}]

        if not features:
            return None

        geometry_list = [shape(f["geometry"]) for f in features if "geometry" in f]
        properties_list = [f.get("properties", {}) for f in features if "geometry" in f]

        if not geometry_list:
            return None

        gdf = gpd.GeoDataFrame(properties_list, geometry=geometry_list, crs="EPSG:4326")
        gdf = gdf.to_crs(epsg=3857)

        # Plot Polygons, Lines, Points
        polys = gdf[gdf.geometry.type.isin(["Polygon", "MultiPolygon"])]
        if not polys.empty:
            polys.plot(
                ax=ax,
                facecolor="#4caf50",
                edgecolor="#2e7d32",
                alpha=0.5,
                linewidth=2,
                zorder=2,
            )

        lines = gdf[gdf.geometry.type == "LineString"]
        if not lines.empty:
            lines.plot(ax=ax, color="#2196f3", linewidth=3, zorder=3)

        points = gdf[gdf.geometry.type == "Point"]
        for idx, row in points.iterrows():
            geom = row.geometry
            props = row.to_dict()
            x, y = geom.x, geom.y

            if props.get("point_type") == "circlemarker":
                radius = props.get("radius", 10)
                ax.scatter(
                    [x],
                    [y],
                    s=radius * 20,
                    color="#e91e63",
                    edgecolor="white",
                    linewidth=1.5,
                    zorder=5,
                )
            else:
                ax.scatter(
                    [x],
                    [y],
                    marker="v",
                    s=120,
                    color="#ff5722",
                    edgecolor="white",
                    linewidth=1.5,
                    zorder=5,
                )

        minx, miny, maxx, maxy = gdf.total_bounds
        x_pad = max((maxx - minx) * 0.15, 200)
        y_pad = max((maxy - miny) * 0.15, 200)

        ax.set_xlim(minx - x_pad, maxx + x_pad)
        ax.set_ylim(miny - y_pad, maxy + y_pad)

        # Map style provider selection dictionary
        provider_map = {
            "OpenStreetMap": ctx.providers.OpenStreetMap.Mapnik,
            "CartoDB Positron": ctx.providers.CartoDB.Positron,
            "CartoDB DarkMatter": ctx.providers.CartoDB.DarkMatter,
        }

        selected_provider = provider_map.get(
            map_style.value, ctx.providers.OpenStreetMap.Mapnik
        )

        # CRITICAL: Define a custom User-Agent identifying your application to comply with OSM policies
        custom_headers = {
            "User-Agent": "FrappeGeolocationImageGenerator/1.0 (Contact: admin@yourdomain.com)"
        }

        # Pass the headers parameter into contextily
        ctx.add_basemap(
            ax, source=selected_provider, zoom="auto", alpha=0.9, headers=custom_headers
        )

        ax.axis("off")
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.1)
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()

        for feature in features:
            geometry = feature.get("geometry", {})
            properties = feature.get("properties", {})
            geom_type = geometry.get("type")
            coords = geometry.get("coordinates")

            if not geom_type or not coords:
                continue

            if geom_type == "Point":
                lng, lat = coords[0], coords[1]
                all_lngs.append(lng)
                all_lats.append(lat)

                # Check custom properties for styling (e.g., your circlemarker)
                if properties.get("point_type") == "circlemarker":
                    radius = properties.get("radius", 10)
                    ax.scatter(
                        [lng],
                        [lat],
                        s=radius * 15,
                        color="#e91e63",
                        edgecolor="white",
                        linewidth=1.5,
                        zorder=5,
                        label="Circle Marker",
                    )
                else:
                    ax.plot(
                        lng,
                        lat,
                        marker="o",
                        markersize=8,
                        color="#ff5722",
                        markeredgecolor="white",
                        markeredgewidth=1.5,
                        zorder=5,
                    )

            elif geom_type == "LineString":
                lngs = [c[0] for c in coords]
                lats = [c[1] for c in coords]
                all_lngs.extend(lngs)
                all_lats.extend(lats)
                ax.plot(lngs, lats, color="#2196f3", linewidth=2.5, zorder=3)

            elif geom_type == "Polygon":
                exterior_ring = coords[0]
                lngs = [c[0] for c in exterior_ring]
                lats = [c[1] for c in exterior_ring]
                all_lngs.extend(lngs)
                all_lats.extend(lats)

                poly_patch = MplPolygon(
                    exterior_ring,
                    closed=True,
                    facecolor="#4caf50",
                    edgecolor="#2e7d32",
                    alpha=0.4,
                    linewidth=2,
                    zorder=2,
                )
                ax.add_patch(poly_patch)

            elif geom_type == "MultiPolygon":
                for polygon in coords:
                    exterior_ring = polygon[0]
                    lngs = [c[0] for c in exterior_ring]
                    lats = [c[1] for c in exterior_ring]
                    all_lngs.extend(lngs)
                    all_lats.extend(lats)

                    poly_patch = MplPolygon(
                        exterior_ring,
                        closed=True,
                        facecolor="#4caf50",
                        edgecolor="#2e7d32",
                        alpha=0.4,
                        linewidth=2,
                        zorder=2,
                    )
                    ax.add_patch(poly_patch)

        # Set map boundaries to fit all geometries perfectly with padding
        if all_lngs and all_lats:
            set_bounds_with_padding(ax, all_lngs, all_lats)
        else:
            return None

        ax.axis("off")
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.1)
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()

    except Exception as e:
        frappe.log_error(title="FeatureCollection Render Error", message=str(e))
        return None


def render_geometry_to_image_without_basemap(geo_data):
    """
    Renders mixed FeatureCollections containing Polygons, LineStrings, and Points into a single image.
    Renders Points, LineStrings, and Polygons locally into image bytes using Matplotlib.
    Renders mixed FeatureCollections containing Polygons, LineStrings, and Points into a single image.
    Aggregate all coordinates across all features so the map canvas can calculate a unified bounding box that frames everything together.
    """
    try:
        if isinstance(geo_data, str):
            geo_data = json.loads(geo_data)

        fig, ax = plt.subplots(figsize=(6, 4), dpi=100)
        ax.set_aspect("equal")
        ax.set_facecolor("#f4f4f4")

        all_lngs = []
        all_lats = []

        # Normalize input to a list of features
        features = []
        if isinstance(geo_data, dict):
            if geo_data.get("type") == "FeatureCollection":
                features = geo_data.get("features", [])
            elif geo_data.get("type") == "Feature":
                features = [geo_data]
            else:
                features = [{"type": "Feature", "geometry": geo_data, "properties": {}}]

        for feature in features:
            geometry = feature.get("geometry", {})
            properties = feature.get("properties", {})
            geom_type = geometry.get("type")
            coords = geometry.get("coordinates")

            if not geom_type or not coords:
                continue

            if geom_type == "Point":
                lng, lat = coords[0], coords[1]
                all_lngs.append(lng)
                all_lats.append(lat)

                # Check custom properties for styling (e.g., your circlemarker)
                if properties.get("point_type") == "circlemarker":
                    radius = properties.get("radius", 10)
                    ax.scatter(
                        [lng],
                        [lat],
                        s=radius * 15,
                        color="#e91e63",
                        edgecolor="white",
                        linewidth=1.5,
                        zorder=5,
                        label="Circle Marker",
                    )
                else:
                    ax.plot(
                        lng,
                        lat,
                        marker="o",
                        markersize=8,
                        color="#ff5722",
                        markeredgecolor="white",
                        markeredgewidth=1.5,
                        zorder=5,
                    )

            elif geom_type == "LineString":
                lngs = [c[0] for c in coords]
                lats = [c[1] for c in coords]
                all_lngs.extend(lngs)
                all_lats.extend(lats)
                ax.plot(lngs, lats, color="#2196f3", linewidth=2.5, zorder=3)

            elif geom_type == "Polygon":
                exterior_ring = coords[0]
                lngs = [c[0] for c in exterior_ring]
                lats = [c[1] for c in exterior_ring]
                all_lngs.extend(lngs)
                all_lats.extend(lats)

                poly_patch = MplPolygon(
                    exterior_ring,
                    closed=True,
                    facecolor="#4caf50",
                    edgecolor="#2e7d32",
                    alpha=0.4,
                    linewidth=2,
                    zorder=2,
                )
                ax.add_patch(poly_patch)

            elif geom_type == "MultiPolygon":
                for polygon in coords:
                    exterior_ring = polygon[0]
                    lngs = [c[0] for c in exterior_ring]
                    lats = [c[1] for c in exterior_ring]
                    all_lngs.extend(lngs)
                    all_lats.extend(lats)

                    poly_patch = MplPolygon(
                        exterior_ring,
                        closed=True,
                        facecolor="#4caf50",
                        edgecolor="#2e7d32",
                        alpha=0.4,
                        linewidth=2,
                        zorder=2,
                    )
                    ax.add_patch(poly_patch)

        # Set map boundaries to fit all geometries perfectly with padding
        if all_lngs and all_lats:
            set_bounds_with_padding(ax, all_lngs, all_lats)
        else:
            return None

        ax.axis("off")
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.1)
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()

    except Exception as e:
        frappe.log_error(title="FeatureCollection Render Error", message=str(e))
        return None


# def render_geometry_to_image3(geo_data):
#     """
#     Renders Points, LineStrings, and Polygons locally into image bytes using Matplotlib.
#     Renders mixed FeatureCollections containing Polygons, LineStrings, and Points into a single image.
#     Aggregate all coordinates across all features so the map canvas can calculate a unified bounding box that frames everything together.
#     """
#     try:
#         # Normalize GeoJSON structure (FeatureCollection vs Feature vs Geometry)
#         if isinstance(geo_data, str):
#             geo_data = json.loads(geo_data)

#         fig, ax = plt.subplots(figsize=(6, 4), dpi=100)
#         ax.set_aspect("equal")
#         ax.set_facecolor("#f4f4f4")

#         all_lngs = []
#         all_lats = []

#         # Normalize input to a list of features
#         features = []
#         if isinstance(geo_data, dict):
#             if geo_data.get("type") == "FeatureCollection":
#                 features = geo_data.get("features", [])
#             elif geo_data.get("type") == "Feature":
#                 features = [geo_data]
#             else:
#                 features = [{"type": "Feature", "geometry": geo_data, "properties": {}}]

#         for feature in features:
#             geometry = feature.get("geometry", {})
#             properties = feature.get("properties", {})
#             geom_type = geometry.get("type")
#             coords = geometry.get("coordinates")

#             if not geom_type or not coords:
#                 continue

#             if geom_type == "Point":
#                 lng, lat = coords[0], coords[1]
#                 all_lngs.append(lng)
#                 all_lats.append(lat)

#                 # Check custom properties for styling (e.g., your circlemarker)
#                 if properties.get("point_type") == "circlemarker":
#                     radius = properties.get("radius", 10)
#                     ax.scatter(
#                         [lng],
#                         [lat],
#                         s=radius * 15,
#                         color="#e91e63",
#                         edgecolor="white",
#                         linewidth=1.5,
#                         zorder=5,
#                         label="Circle Marker",
#                     )
#                 else:
#                     ax.plot(
#                         lng,
#                         lat,
#                         marker="o",
#                         markersize=8,
#                         color="#ff5722",
#                         markeredgecolor="white",
#                         markeredgewidth=1.5,
#                         zorder=5,
#                     )

#             if geom_type == "LineString":
#                 lngs = [c[0] for c in coords]
#                 lats = [c[1] for c in coords]
#                 all_lngs.extend(lngs)
#                 all_lats.extend(lats)
#                 ax.plot(lngs, lats, color="#2196f3", linewidth=2.5, zorder=3)

#             if geom_type == "Polygon":
#                 exterior_ring = coords[0]
#                 lngs = [c[0] for c in exterior_ring]
#                 lats = [c[1] for c in exterior_ring]
#                 all_lngs.extend(lngs)
#                 all_lats.extend(lats)

#                 poly_patch = MplPolygon(
#                     exterior_ring,
#                     closed=True,
#                     facecolor="#4caf50",
#                     edgecolor="#2e7d32",
#                     alpha=0.4,
#                     linewidth=2,
#                     zorder=2,
#                 )
#                 ax.add_patch(poly_patch)

#             elif geom_type == "MultiPolygon":
#                 for polygon in coords:
#                     exterior_ring = polygon[0]
#                     lngs = [c[0] for c in exterior_ring]
#                     lats = [c[1] for c in exterior_ring]
#                     all_lngs.extend(lngs)
#                     all_lats.extend(lats)

#                     poly_patch = MplPolygon(
#                         exterior_ring,
#                         closed=True,
#                         facecolor="#4caf50",
#                         edgecolor="#2e7d32",
#                         alpha=0.4,
#                         linewidth=2,
#                         zorder=2,
#                     )
#                     ax.add_patch(poly_patch)

#         # Set map boundaries to fit all geometries perfectly with padding
#         if all_lngs and all_lats:
#             set_bounds_with_padding(ax, all_lngs, all_lats)
#         else:
#             return None

#         # if "features" in geo_data and geo_data["features"]:
#         #     geometry = geo_data["features"][0].get("geometry", {})
#         # elif "geometry" in geo_data:
#         #     geometry = geo_data["geometry"]
#         # else:
#         #     geometry = geo_data

#         # geom_type = geometry.get("type")
#         # coords = geometry.get("coordinates")

#         # if not geom_type or not coords:
#         #     return None

#         fig, ax = plt.subplots(figsize=(6, 4), dpi=100)
#         ax.set_aspect("equal")
#         ax.set_facecolor("#f4f4f4")

#         if geom_type == "Point":
#             lng, lat = coords[0], coords[1]
#             ax.plot(
#                 lng,
#                 lat,
#                 marker="o",
#                 markersize=10,
#                 color="#ff5722",
#                 markeredgecolor="white",
#                 markeredgewidth=1.5,
#             )
#             # Add padding around the point
#             padding = 0.01
#             ax.set_xlim(lng - padding, lng + padding)
#             ax.set_ylim(lat - padding, lat + padding)

#         elif geom_type == "LineString":
#             lngs = [c[0] for c in coords]
#             lats = [c[1] for c in coords]
#             ax.plot(lngs, lats, color="#2196f3", linewidth=3)
#             set_bounds_with_padding(ax, lngs, lats)

#         elif geom_type == "Polygon":
#             # GeoJSON polygons contain an exterior ring and optional interior rings (holes)
#             exterior_ring = coords[0]
#             lngs = [c[0] for c in exterior_ring]
#             lats = [c[1] for c in exterior_ring]
#             # Matplotlib polygon expects (N, 2) array of (x, y) -> (lng, lat)
#             poly_patch = MplPolygon(
#                 exterior_ring,
#                 closed=True,
#                 facecolor="#4caf50",
#                 edgecolor="#2e7d32",
#                 alpha=0.6,
#                 linewidth=2,
#             )
#             ax.add_patch(poly_patch)
#             set_bounds_with_padding(ax, lngs, lats)

#         elif geom_type == "MultiPolygon":
#             all_lngs, all_lats = [], []
#             for polygon in coords:
#                 exterior_ring = polygon[0]
#                 lngs = [c[0] for c in exterior_ring]
#                 lats = [c[1] for c in exterior_ring]
#                 all_lngs.extend(lngs)
#                 all_lats.extend(lats)
#                 poly_patch = MplPolygon(
#                     exterior_ring,
#                     closed=True,
#                     facecolor="#4caf50",
#                     edgecolor="#2e7d32",
#                     alpha=0.6,
#                     linewidth=2,
#                 )
#                 ax.add_patch(poly_patch)
#             set_bounds_with_padding(ax, all_lngs, all_lats)

#         # Remove axes grid and ticks for a clean snapshot appearance
#         ax.axis("off")
#         plt.tight_layout()

#         # Save figure to in-memory bytes buffer
#         buf = io.BytesIO()
#         plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.1)
#         plt.close(fig)
#         buf.seek(0)
#         return buf.getvalue()

#     except Exception as e:
#         frappe.log_error(title="Geometry Render Parsing Error", message=str(e))
#         return None


# def render_geometry_to_image2(geo_data):
#     """
#     Renders Points, LineStrings, and Polygons locally into image bytes using Matplotlib.
#     Renders mixed FeatureCollections containing Polygons, LineStrings, and Points into a single image.
#     """
#     try:
#         # Normalize GeoJSON structure (FeatureCollection vs Feature vs Geometry)
#         if "features" in geo_data and geo_data["features"]:
#             geometry = geo_data["features"][0].get("geometry", {})
#         elif "geometry" in geo_data:
#             geometry = geo_data["geometry"]
#         else:
#             geometry = geo_data

#         geom_type = geometry.get("type")
#         coords = geometry.get("coordinates")

#         if not geom_type or not coords:
#             return None

#         fig, ax = plt.subplots(figsize=(6, 4), dpi=100)
#         ax.set_aspect("equal")
#         ax.set_facecolor("#f4f4f4")

#         if geom_type == "Point":
#             lng, lat = coords[0], coords[1]
#             ax.plot(
#                 lng,
#                 lat,
#                 marker="o",
#                 markersize=10,
#                 color="#ff5722",
#                 markeredgecolor="white",
#                 markeredgewidth=1.5,
#             )
#             # Add padding around the point
#             padding = 0.01
#             ax.set_xlim(lng - padding, lng + padding)
#             ax.set_ylim(lat - padding, lat + padding)

#         elif geom_type == "LineString":
#             lngs = [c[0] for c in coords]
#             lats = [c[1] for c in coords]
#             ax.plot(lngs, lats, color="#2196f3", linewidth=3)
#             set_bounds_with_padding(ax, lngs, lats)

#         elif geom_type == "Polygon":
#             # GeoJSON polygons contain an exterior ring and optional interior rings (holes)
#             exterior_ring = coords[0]
#             lngs = [c[0] for c in exterior_ring]
#             lats = [c[1] for c in exterior_ring]
#             # Matplotlib polygon expects (N, 2) array of (x, y) -> (lng, lat)
#             poly_patch = MplPolygon(
#                 exterior_ring,
#                 closed=True,
#                 facecolor="#4caf50",
#                 edgecolor="#2e7d32",
#                 alpha=0.6,
#                 linewidth=2,
#             )
#             ax.add_patch(poly_patch)
#             set_bounds_with_padding(ax, lngs, lats)

#         elif geom_type == "MultiPolygon":
#             all_lngs, all_lats = [], []
#             for polygon in coords:
#                 exterior_ring = polygon[0]
#                 lngs = [c[0] for c in exterior_ring]
#                 lats = [c[1] for c in exterior_ring]
#                 all_lngs.extend(lngs)
#                 all_lats.extend(lats)
#                 poly_patch = MplPolygon(
#                     exterior_ring,
#                     closed=True,
#                     facecolor="#4caf50",
#                     edgecolor="#2e7d32",
#                     alpha=0.6,
#                     linewidth=2,
#                 )
#                 ax.add_patch(poly_patch)
#             set_bounds_with_padding(ax, all_lngs, all_lats)

#         # Remove axes grid and ticks for a clean snapshot appearance
#         ax.axis("off")
#         plt.tight_layout()

#         # Save figure to in-memory bytes buffer
#         buf = io.BytesIO()
#         plt.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.1)
#         plt.close(fig)
#         buf.seek(0)
#         return buf.getvalue()

#     except Exception as e:
#         frappe.log_error(title="Geometry Render Parsing Error", message=str(e))
#         return None


def set_bounds_with_padding(ax, lngs, lats, padding_ratio=0.1):
    """Dynamically sets map bounds based on data coordinates with padding."""
    min_lng, max_lng = min(lngs), max(lngs)
    min_lat, max_lat = min(lats), max(lats)

    lng_range = max(max_lng - min_lng, 0.001)
    lat_range = max(max_lat - min_lat, 0.001)

    ax.set_xlim(
        min_lng - (lng_range * padding_ratio), max_lng + (lng_range * padding_ratio)
    )
    ax.set_ylim(
        min_lat - (lat_range * padding_ratio), max_lat + (lat_range * padding_ratio)
    )


def generate_image_via_external_api(geo_data):
    coords = extract_coordinates(geo_data)
    if not coords:
        return None

    lat, lng = coords

    # Generate or fetch map image
    image_url = f"https://static-map-api-example.com/render?lat={lat}&lon={lng}&zoom=14&size=600x400"
    response = requests.get(image_url, timeout=10)
    return response


def extract_coordinates(geo_data):
    """Helper to extract center coordinates from GeoJSON data structure."""
    try:
        if "features" in geo_data and geo_data["features"]:
            geom = geo_data["features"][0].get("geometry", {})
        elif "geometry" in geo_data:
            geom = geo_data["geometry"]
        else:
            geom = geo_data

        coords = geom.get("coordinates")
        geom_type = geom.get("type")

        if geom_type == "Point":
            return coords[1], coords[0]  # Lat, Lng
        elif geom_type in ["Polygon", "LineString"]:
            return coords[0][0][1], coords[0][0][0]
    except Exception:
        pass
    return None
