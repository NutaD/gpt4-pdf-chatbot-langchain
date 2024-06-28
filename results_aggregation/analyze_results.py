import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os

# Load the aggregated CSV file
file_path = 'combined_eval_results.csv'
data = pd.read_csv(file_path)

# Ensure the output directory exists
output_dir = 'analysis_results'
os.makedirs(output_dir, exist_ok=True)

# Calculate statistics for each combination of Eval Model and Sources Retrieved
grouped_stats = data.groupby(['Eval Model', 'Sources Retrieved'])['score'].agg(['mean', 'std', 'median', 'min', 'max']).reset_index()
grouped_stats['iqr'] = data.groupby(['Eval Model', 'Sources Retrieved'])['score'].apply(lambda x: np.percentile(x, 75) - np.percentile(x, 25)).values

print("Detailed Statistics for Each Combination of Eval Model and Sources Retrieved:")
print(grouped_stats)

# Save the detailed statistics to a CSV file
grouped_stats.to_csv(os.path.join(output_dir, 'detailed_statistics.csv'), index=False)

# Plot mean scores
plt.figure(figsize=(10, 6))
sns.barplot(x='Sources Retrieved', y='mean', hue='Eval Model', data=grouped_stats)
plt.title('Mean Score by Eval Model and Number of Sources Retrieved')
plt.xlabel('Number of Sources Retrieved')
plt.ylabel('Mean Score')
plt.grid(True)
plt.savefig(os.path.join(output_dir, 'mean_scores.png'))
plt.close()

# Plot standard deviation
plt.figure(figsize=(10, 6))
sns.barplot(x='Sources Retrieved', y='std', hue='Eval Model', data=grouped_stats)
plt.title('Standard Deviation of Scores by Eval Model and Number of Sources Retrieved')
plt.xlabel('Number of Sources Retrieved')
plt.ylabel('Standard Deviation')
plt.grid(True)
plt.savefig(os.path.join(output_dir, 'std_dev_scores.png'))
plt.close()

# Plot median scores
plt.figure(figsize=(10, 6))
sns.barplot(x='Sources Retrieved', y='median', hue='Eval Model', data=grouped_stats)
plt.title('Median Score by Eval Model and Number of Sources Retrieved')
plt.xlabel('Number of Sources Retrieved')
plt.ylabel('Median Score')
plt.grid(True)
plt.savefig(os.path.join(output_dir, 'median_scores.png'))
plt.close()

# Plot IQR
plt.figure(figsize=(10, 6))
sns.barplot(x='Sources Retrieved', y='iqr', hue='Eval Model', data=grouped_stats)
plt.title('Interquartile Range of Scores by Eval Model and Number of Sources Retrieved')
plt.xlabel('Number of Sources Retrieved')
plt.ylabel('IQR')
plt.grid(True)
plt.savefig(os.path.join(output_dir, 'iqr_scores.png'))
plt.close()

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
            filename = f'{eval_model}_k{sources}_score_distribution.png'
            plt.savefig(os.path.join(output_dir, filename))
            plt.close()

print("Detailed plots and statistics have been saved successfully.")
