import pandas as pd
import re
import os

# Get the directory where the script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(script_dir) 

# Use relative paths based on the script location
profile_df = pd.read_csv(os.path.join(project_dir, 'static/data/original/neighbourhood-profiles-2016-csv.csv'))
crime_df = pd.read_csv(os.path.join(project_dir, 'static/data/original/neighbourhood-crime-rates.csv'))

# get the intersection of two data above
# Get neighbourhood names from profile_df (excluding non-neighbourhood columns)
profile_neighbourhoods = set(profile_df.columns[6:])  # Skip first 6 columns which are metadata

# Get neighbourhood names from crime_df
crime_neighbourhoods = set(crime_df["Neighbourhood"])

# Get the intersection
common_neighbourhoods = profile_neighbourhoods.intersection(crime_neighbourhoods)
name_mapping = {
    'Cabbagetown-South St.James Town': 'Cabbagetown-South St. James Town',
    'North St.James Town': 'North St. James Town',
    'Weston-Pellam Park': 'Weston-Pelham Park'
}

# Replace the names in crime_df
crime_df['Neighbourhood'] = crime_df['Neighbourhood'].replace(name_mapping)

# Verify the intersection again
crime_neighbourhoods = set(crime_df["Neighbourhood"])
common_neighbourhoods = profile_neighbourhoods.intersection(crime_neighbourhoods)

# First, identify the crime types and years
base_cols = ['_id', 'OBJECTID', 'Neighbourhood', 'Hood_ID', 'F2020_Population_Projection', 'geometry']

# Separate count and rate columns
count_cols = [col for col in crime_df.columns 
              if col not in base_cols and 'Rate' not in col]
rate_cols = [col for col in crime_df.columns if 'Rate' in col]

# reformating words to lower case
def format_crime_type_regex(text):
    text = re.sub(r'(?<!^)(?=[A-Z])', ' ', text)
    lower_case_words = {'and', 'or', 'of', 'in', 'the', 'on', 'at'}
    words = text.split()
    formatted_words = [word.lower() if word.lower() in lower_case_words else word 
                      for word in words]
    return ' '.join(formatted_words)

# Melt count columns
count_df = pd.melt(
    crime_df,
    id_vars=base_cols,
    value_vars=count_cols,
    var_name='crime_type_year',
    value_name='crime_count'
)

# Melt rate columns
rate_df = pd.melt(
    crime_df,
    id_vars=base_cols,
    value_vars=rate_cols,
    var_name='crime_type_year',
    value_name='crime_rate'
)

# Extract crime type and year from count_df
count_df[['crime_type', 'year']] = count_df['crime_type_year'].str.extract(r'(.+)_(\d{4})')

# Extract crime type and year from rate_df (note the different pattern for rate columns)
rate_df[['crime_type', 'year']] = rate_df['crime_type_year'].str.extract(r'(.+)_Rate(\d{4})')

# Fix the specific issue with "Shooting" vs "Shootings"
# Convert any "Shooting" (singular) to "Shootings" (plural) for consistency
rate_df.loc[rate_df['crime_type'] == 'Shooting', 'crime_type'] = 'Shootings'

# Also fix the same issue in count_df for complete consistency
count_df.loc[count_df['crime_type'] == 'Shooting', 'crime_type'] = 'Shootings'

# Drop temporary columns
count_df = count_df.drop('crime_type_year', axis=1)
rate_df = rate_df.drop('crime_type_year', axis=1)

# Merge count and rate dataframes
crime_df_long = pd.merge(
    count_df,
    rate_df[['Neighbourhood', 'crime_type', 'year', 'crime_rate']],
    on=['Neighbourhood', 'crime_type', 'year']
)

# Select and rename final columns
crime_df_long = (crime_df_long[
    ['Neighbourhood', 'crime_type', 'year', 'F2020_Population_Projection', 'crime_count', 'crime_rate']]
    .rename(columns={'Neighbourhood': 'neighbourhood', 'F2020_Population_Projection': 'population'})
    .sort_values(by=['neighbourhood', 'crime_type', 'year'], ascending=[True, True, True]))

# First calculate population based on crime count and rate
population_calc = (crime_df_long['crime_count'] / crime_df_long['crime_rate']) * 100000
initial_population = population_calc.replace([float('inf'), float('-inf')], 0).fillna(0).round().astype(int)
crime_df_long['population'] = initial_population

# Replace the groupby operation with a more compatible approach
def update_population(df):
    for (neigh, year), group in df.groupby(['neighbourhood', 'year']):
        mask = (df['neighbourhood'] == neigh) & (df['year'] == year)
        non_zero_pop = group['population'].max()  # Get the maximum non-zero population
        if non_zero_pop > 0:
            df.loc[mask, 'population'] = non_zero_pop
    return df

# Apply the population update
crime_df_long = update_population(crime_df_long)

crime_df_long["crime_type"] = crime_df_long['crime_type'].apply(format_crime_type_regex)

# Replace 'Break and Enter' with 'Burglary'
crime_df_long['crime_type'] = crime_df_long['crime_type'].replace('Break and Enter', 'Burglary')

# Aggregate the data for Toronto-wide statistics
toronto_df = crime_df_long.groupby(['crime_type', 'year']).agg({
    'population': 'sum',
    'crime_count': 'sum'
}).reset_index()

# Calculate the crime rate for Toronto-wide data
toronto_df['crime_rate'] = (toronto_df['crime_count'] / toronto_df['population']) * 100000
toronto_df['neighbourhood'] = 'Toronto'  # Add neighbourhood column with 'toronto'

# Combine the neighbourhood-level and Toronto-wide data
crime_df_long = pd.concat([crime_df_long, toronto_df], ignore_index=True)

# Sort values again before saving
crime_df_long = crime_df_long.sort_values(by=['neighbourhood', 'crime_type', 'year'])

# Save to CSV using relative path
crime_df_long.to_csv(os.path.join(project_dir, 'static/data/processed/neighbourhood-crime-rates.csv'), index=False)