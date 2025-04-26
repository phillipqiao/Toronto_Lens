#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// Get the directory name using ES module approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URLs to map data
const worldMapUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const countryCentroidsUrl =
	'https://cdn.jsdelivr.net/gh/gavinr/world-countries-centroids@v1/dist/countries.geojson';

// Output paths
const worldOutputPath = path.join(__dirname, '../static/data/original/world.json');
const centroidsOutputPath = path.join(__dirname, '../static/data/original/country-centroids.json');

// Helper function to download data
const downloadFile = (url, outputPath, description) => {
	console.log(`Downloading ${description} from ${url}...`);

	// Create directories if they don't exist
	const dir = path.dirname(outputPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	// Download the file
	return new Promise((resolve, reject) => {
		https
			.get(url, (response) => {
				const { statusCode } = response;

				if (statusCode !== 200) {
					reject(new Error(`Failed to download. Status Code: ${statusCode}`));
					response.resume(); // Consume response to free up memory
					return;
				}

				let rawData = '';
				response.setEncoding('utf8');

				response.on('data', (chunk) => {
					rawData += chunk;
				});

				response.on('end', () => {
					try {
						// Parse and save JSON to ensure it's valid
						const data = JSON.parse(rawData);

						// Save to file
						fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
						console.log(`${description} saved to ${outputPath}`);
						resolve(data);
					} catch (e) {
						reject(new Error(`Error parsing or saving data: ${e.message}`));
					}
				});
			})
			.on('error', (e) => {
				reject(new Error(`Error downloading data: ${e.message}`));
			});
	});
};

// Main function to download all required data
async function downloadData() {
	try {
		// Download world map data
		const worldData = await downloadFile(worldMapUrl, worldOutputPath, 'World map data');

		// Ensure the file has the expected structure
		if (!worldData.objects || !worldData.objects.countries) {
			throw new Error('Downloaded world map file does not have the expected TopoJSON structure');
		}

		// Download country centroids data
		const centroidsData = await downloadFile(
			countryCentroidsUrl,
			centroidsOutputPath,
			'Country centroids data'
		);

		// Ensure the file has the expected structure
		if (!centroidsData.type || centroidsData.type !== 'FeatureCollection') {
			throw new Error('Downloaded centroids file does not have the expected GeoJSON structure');
		}

		console.log('All data downloaded successfully!');
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}

// Start the download process
downloadData();
