import type { GeoFeature } from '$lib/types/chart/map';
import polylabel from 'polylabel';
import type { Position } from 'geojson';
import { geoCentroid, polygonArea } from 'd3';

export function findOptimalCenterPoint(
	feature: GeoFeature,
	precision: number = 1.0
): [number, number] {
	try {
		// Get the coordinates array
		const coords = extractCoordinates(feature);

		if (!coords || coords.length === 0) {
			// If there are no coordinates, fall back to the centroid calculation
			return geoCentroid(feature);
		}

		// precision parameter determines the accuracy of the algorithm, with lower values being faster but less accurate
		const pointWithDistance = polylabel(coords, precision);

		// 提取坐标部分，忽略 distance 属性
		const [x, y] = pointWithDistance;
		return [x, y];
	} catch (error) {
		console.error('Error calculating the center point:', error);
		// Fall back to the centroid calculation if there is an error
		return geoCentroid(feature);
	}
}

function extractCoordinates(feature: GeoFeature): Position[][] | null {
	const geometry = feature.geometry;
	const type = geometry.type;

	if (type === 'Polygon') {
		return [geometry.coordinates[0]];
	} else if (type === 'MultiPolygon') {
		const polygons = geometry.coordinates;

		// Calculate the area of each polygon and select the largest one
		let maxArea = 0;
		let largestPolyIndex = 0;

		polygons.forEach((poly, index) => {
			// Calculate the area (using a simple method)
			const ring = poly[0]; // Outer ring
			const area = Math.abs(polygonArea(ring.map((p) => [p[0], p[1]])));
			if (area > maxArea) {
				maxArea = area;
				largestPolyIndex = index;
			}
		});

		return [polygons[largestPolyIndex][0]];
	}

	return null;
}
