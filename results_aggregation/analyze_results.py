import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
# Get the current directory of the script
aggFolder = os.path.dirname(os.getenv('evalResFileCsv'))
aggFileName = os.getenv('aggFileName')
output_dir = aggFolder
# Construct the path to the combined_eval_results_test.csv file
file_path = os.path.join(aggFolder, aggFileName)

# Read the CSV file
data = pd.read_csv(file_path)

# Ensure the output directory exists
os.makedirs(output_dir, exist_ok=True)

# Calculate statistics for each combination of Eval Model and Sources Retrieved
grouped_stats = data.groupby(['Eval Model', 'Sources Retrieved'])['score'].agg(['mean', 'std', 'median', 'min', 'max']).reset_index()
grouped_stats['iqr'] = data.groupby(['Eval Model', 'Sources Retrieved'])['score'].apply(lambda x: np.percentile(x, 75) - np.percentile(x, 25)).values

# Extracting the filename without the extension
fileNameWithoutExtension = os.path.splitext(aggFileName)[0]

# Constructing the new filenames
statsFileName = f'stats_{fileNameWithoutExtension}.csv'
meanScoresFileName = f'mean_scores_{fileNameWithoutExtension}.png'
stdDevScoresFileName = f'std_dev_scores_{fileNameWithoutExtension}.png'
medianScoresFileName = f'median_scores_{fileNameWithoutExtension}.png'
iqrScoresFileName = f'iqr_scores_{fileNameWithoutExtension}.png'

print("Detailed Statistics for Each Combination of Eval Model and Sources Retrieved:")
print(grouped_stats)

# Save the detailed statistics to a CSV file
grouped_stats.to_csv(os.path.join(output_dir, statsFileName), index=False)

# Plot mean scores
# plt.figure(figsize=(10, 6))
# sns.barplot(x='Sources Retrieved', y='mean', hue='Eval Model', data=grouped_stats)
# plt.title('Mean Score by Eval Model and Number of Sources Retrieved')
# plt.xlabel('Number of Sources Retrieved')
# plt.ylabel('Mean Score')
# plt.grid(True)
# plt.savefig(os.path.join(output_dir, meanScoresFileName))
# plt.close()

# Plot standard deviation
# plt.figure(figsize=(10, 6))
# sns.barplot(x='Sources Retrieved', y='std', hue='Eval Model', data=grouped_stats)
# plt.title('Standard Deviation of Scores by Eval Model and Number of Sources Retrieved')
# plt.xlabel('Number of Sources Retrieved')
# plt.ylabel('Standard Deviation')
# plt.grid(True)
# plt.savefig(os.path.join(output_dir, stdDevScoresFileName))
# plt.close()

# Plot median scores
# plt.figure(figsize=(10, 6))
# sns.barplot(x='Sources Retrieved', y='median', hue='Eval Model', data=grouped_stats)
# plt.title('Median Score by Eval Model and Number of Sources Retrieved')
# plt.xlabel('Number of Sources Retrieved')
# plt.ylabel('Median Score')
# plt.grid(True)
# plt.savefig(os.path.join(output_dir, medianScoresFileName))
# plt.close()

# Plot IQR
# plt.figure(figsize=(10, 6))
# sns.barplot(x='Sources Retrieved', y='iqr', hue='Eval Model', data=grouped_stats)
# plt.title('Interquartile Range of Scores by Eval Model and Number of Sources Retrieved')
# plt.xlabel('Number of Sources Retrieved')
# plt.ylabel('IQR')
# plt.grid(True)
# plt.savefig(os.path.join(output_dir, iqrScoresFileName))
# plt.close()

# Generate and save histograms for each combination of Eval Model and Sources Retrieved
for eval_model in data['Eval Model'].unique():
    for sources in data['Sources Retrieved'].unique():
        subset = data[(data['Eval Model'] == eval_model) & (data['Sources Retrieved'] == sources)]
        if not subset.empty:
            plt.figure(figsize=(10, 6))
            sns.histplot(subset['score'], bins=10, kde=True)
            plt.title(f'Score Distribution evaluated by {eval_model} model with {sources} Sources Retrieved')
            plt.xlabel('Score')
            plt.ylabel('Frequency')
            plt.grid(True)
            filename = f'{eval_model}_k{sources}_{fileNameWithoutExtension}_score_distribution.png'
            plt.savefig(os.path.join(output_dir, filename))
            plt.close()

print("Detailed plots and statistics have been saved successfully.")
