import os
import yaml
import psycopg
from dotenv import load_dotenv

load_dotenv()
# Use the read-only user for safety. Note: We need to parse the ADMIN URL to swap the user/password.
# For simplicity in this step, we will just use the ADMIN URL to read the schema, 
# but in the actual MCP server, we will strictly use the reader credentials.
DB_URL = os.getenv("NEON_DB_URL")

def get_schema():
    schema_dict = {"tables": []}
    
    query = """
        SELECT 
            t.table_name,
            c.column_name,
            c.data_type
        FROM 
            information_schema.tables t
        JOIN 
            information_schema.columns c ON t.table_name = c.table_name
        WHERE 
            t.table_schema = 'public' 
            -- Exclude staging tables and logs to keep context clean
            AND t.table_name NOT LIKE 'staging_%'
            AND t.table_name != 'pipeline_run_log'
        ORDER BY 
            t.table_name, c.ordinal_position;
    """

    try:
        with psycopg.connect(DB_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
                
                current_table = None
                table_obj = {}
                
                for row in rows:
                    table_name, column_name, data_type = row
                    
                    if table_name != current_table:
                        if current_table is not None:
                            schema_dict["tables"].append(table_obj)
                        
                        current_table = table_name
                        table_obj = {
                            "name": table_name,
                            "description": "", # We will fill these in manually in the next step
                            "columns": []
                        }
                    
                    table_obj["columns"].append({
                        "name": column_name,
                        "type": data_type,
                        "description": "" # We will fill these in manually
                    })
                
                # Append the last table
                if table_obj:
                    schema_dict["tables"].append(table_obj)
                    
        # Write to YAML
        with open("schema.yaml", "w") as f:
            yaml.dump(schema_dict, f, default_flow_style=False, sort_keys=False)
            
        print("✅ Schema successfully extracted to 'schema.yaml'.")
        
    except Exception as e:
        print(f"❌ Error extracting schema: {e}")

if __name__ == "__main__":
    get_schema()
