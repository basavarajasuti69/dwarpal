import yaml

def enrich_schema():
    with open("schema.yaml", "r") as f:
        schema = yaml.safe_load(f)

    # 1. Add descriptions to the EV tables
    for table in schema.get("tables", []):
        if table["name"] == "ev_state_registrations":
            table["description"] = "State-wise electric vehicle registration counts by year and category (2W, 4W)."
        elif table["name"] == "ev_charging_stations":
            table["description"] = "Count of public and fast EV charging stations per state in India."
            for col in table["columns"]:
                if col["name"] == "fast_chargers":
                    col["description"] = "Number of DC fast chargers (subset of public chargers)."

    # 2. Add Few-Shot Examples
    schema["examples"] = [
        # Olist Examples (Assuming standard column names)
        {"domain": "Olist", "question": "How many total customers are there?", "sql": "SELECT COUNT(customer_id) FROM dim_customers;"},
        {"domain": "Olist", "question": "Which seller state has the most sellers?", "sql": "SELECT seller_state, COUNT(seller_id) as total FROM dim_sellers GROUP BY seller_state ORDER BY total DESC LIMIT 1;"},
        {"domain": "Olist", "question": "What is the average review score?", "sql": "SELECT AVG(review_score) FROM fact_reviews;"},
        {"domain": "Olist", "question": "Show the top 5 product categories by number of products.", "sql": "SELECT product_category_name, COUNT(product_id) as cnt FROM dim_products GROUP BY product_category_name ORDER BY cnt DESC LIMIT 5;"},
        {"domain": "Olist", "question": "What is the total freight value paid?", "sql": "SELECT SUM(freight_value) FROM fact_order_items;"},
        
        # India EV Examples
        {"domain": "India EV", "question": "Which state has the most 2W EV registrations?", "sql": "SELECT state_name FROM ev_state_registrations WHERE vehicle_category = '2W' ORDER BY total_units DESC LIMIT 1;"},
        {"domain": "India EV", "question": "Total fast chargers in Maharashtra?", "sql": "SELECT fast_chargers FROM ev_charging_stations WHERE state_name = 'Maharashtra';"},
        {"domain": "India EV", "question": "How many 4W EVs were registered in Delhi in 2024?", "sql": "SELECT total_units FROM ev_state_registrations WHERE state_name = 'Delhi' AND vehicle_category = '4W' AND registration_year = 2024;"},
        {"domain": "India EV", "question": "List all states with more than 1500 fast chargers.", "sql": "SELECT state_name FROM ev_charging_stations WHERE fast_chargers > 1500;"},
        {"domain": "India EV", "question": "What is the total number of public chargers across all states?", "sql": "SELECT SUM(public_chargers) FROM ev_charging_stations;"}
    ]

    with open("schema.yaml", "w") as f:
        yaml.dump(schema, f, default_flow_style=False, sort_keys=False)
        
    print("✅ Successfully enriched schema.yaml with descriptions and examples.")

if __name__ == "__main__":
    enrich_schema()
