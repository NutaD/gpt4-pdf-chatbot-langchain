import pandas as pd
import glob
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

aggFolder = os.path.dirname(os.getenv('evalResFileCsv'))
resFileName = 'm_polaris_eval_results*_k*_gpt*.csv'
aggFileName = os.getenv('aggFileName')

# Function to extract the eval model and k value from the filename
def extract_info_from_filename(filename):
    eval_model = "GPT-3.5-turbo" if "gpt35" in filename else "GPT-4"

    # Extract k_value handling both 12 and 12detailed cases
    k_value = filename.split('_k')[1].split('_')[0]

    return eval_model, k_value


# Construct the path to the res_eval folder
current_dir = os.path.dirname(os.path.abspath(__file__))
res_eval_path = os.path.abspath(os.path.join(current_dir, '..', aggFolder))

# Get a list of all relevant CSV files
csv_files = glob.glob(os.path.join(res_eval_path, resFileName ))

# Print the list of found files for verification
print(f"Found CSV files: {csv_files}")

# List to hold dataframes
df_list = []

# Process each CSV file
for file in csv_files:
    try:
        df = pd.read_csv(file)
        eval_model, k_value = extract_info_from_filename(file)
        df['Eval Model'] = eval_model
        df['Sources Retrieved'] = k_value
        df_list.append(df)
        print(f"Processed file: {file}")
    except Exception as e:
        print(f"Error processing file {file}: {e}")

# Check if df_list is empty
if not df_list:
    print("No dataframes were created. Exiting...")
    exit(1)

# Concatenate all dataframes
combined_df = pd.concat(df_list, ignore_index=True)

# Reorder columns as required
combined_df = combined_df[
    ['prompt', 'referenceAnswer', 'generatedAnswer', 'score', 'explanation', 'Eval Model', 'Sources Retrieved']]

# Save the combined dataframe to a new CSV file
output_file = os.path.join(res_eval_path, aggFileName)
combined_df.to_csv(output_file, index=False)

print("CSV files aggregated successfully.")
