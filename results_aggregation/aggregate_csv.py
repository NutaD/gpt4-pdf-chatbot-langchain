import pandas as pd
import glob

# Function to extract the eval model and k value from the filename
def extract_info_from_filename(filename):
    eval_model = "GPT-3.5-turbo" if "gpt35" in filename else "GPT-4"
    k_value = int(filename.split('_k')[1].split('_')[0])
    return eval_model, k_value

# Get a list of all relevant CSV files
csv_files = glob.glob('eval_results_k*_gpt*.csv')

# List to hold dataframes
df_list = []

# Process each CSV file
for file in csv_files:
    df = pd.read_csv(file)
    eval_model, k_value = extract_info_from_filename(file)
    df['Eval Model'] = eval_model
    df['Sources Retrieved'] = k_value
    df_list.append(df)

# Concatenate all dataframes
combined_df = pd.concat(df_list, ignore_index=True)

# Reorder columns as required
combined_df = combined_df[['prompt', 'referenceAnswer', 'generatedAnswer', 'score', 'explanation', 'Eval Model', 'Sources Retrieved']]

# Save the combined dataframe to a new CSV file
output_file = 'combined_eval_results.csv'
combined_df.to_csv(output_file, index=False)

print("CSV files aggregated successfully.")
