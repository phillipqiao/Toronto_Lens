import pandas as pd

# upload data
file_path = "static/data/processed/mother-tongue-2016.csv"
df = pd.read_csv(file_path)

# define the keywords list
broad_language_keywords = [
    'languages', 'Multiple responses', 'Single responses',
    'Non-Aboriginal', 'Non-official', 'Official',
    'Indo-European', 'Indo-Aryan', 'Dravidian',
    'Chinese languages', 'Sino-Tibetan', 'Slavic languages',
    'Afro-Asiatic', 'Germanic', 'Italic', 'Semitic',
    'Turkic', 'Austro-Asiatic', 'Austronesian',
    'Iranian', 'Celtic', 'Iroquoian', 'Algonquian',
    'Athabaskan', 'Salish', 'Siouan', 'Tsimshian',
    'Wakashan', 'Sign languages', 'Uralic', 'Tai-Kadai',
    'Niger-Congo', 'Nilo-Saharan'
]


# define the column names which are not languages
non_language_columns = [
    'Mother tongue for the total population excluding institutional residents',
    'English and French',
    'English and non-official language',
    'English, French and non-official language',
    'French and non-official language',
    'Official languages',
    'Single responses',
    'Multiple responses'
]

# define the function that filters the columns
def is_specific_language(col):
    if col == 'neighbourhood':
        return True
    if col in non_language_columns:
        return False
    return not any(keyword in col for keyword in broad_language_keywords)

# apply the filter to the dataset
filtered_df = df.loc[:, [col for col in df.columns if is_specific_language(col)]]

# save the cleaned dataset to file
filtered_df.to_csv("static/data/processed/filtered_languages.csv", index=False)