import { useState, useCallback } from 'react';
import { geocodeRegion } from '@/services/geocoding';
import { searchImagery } from '@/services/usgs';
import type { ImageryResult, GeocodingResult } from '@/types/imagery';

export function useImagerySearch() {
  const [geocodingResults, setGeocodingResults] = useState<GeocodingResult[]>([]);
  const [imageryResults, setImageryResults] = useState<ImageryResult[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<GeocodingResult | null>(null);
  const [lastFilters, setLastFilters] = useState<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleGeocode = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsGeocoding(true);
    setError(null);
    try {
      const results = await geocodeRegion(query);
      setGeocodingResults(results);
      if (results.length === 1) setSelectedLocation(results[0]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const handleSelectLocation = useCallback((location: GeocodingResult) => {
    setSelectedLocation(location);
    setGeocodingResults([]);
  }, []);

  const handleSearch = useCallback(
    async (filters: { startDate: string; endDate: string; maxCloudCover: number; dataset: string }) => {
      if (!selectedLocation) {
        setError('Select a location first');
        return;
      }
      setIsSearching(true);
      setError(null);
      try {
        const [south, north, west, east] = selectedLocation.boundingBox;
        const searchParams = { ...filters, south, north, west, east, startingNumber: 1, maxResults: 50 };
        setLastFilters(searchParams);
        
        const response = await searchImagery(searchParams);
        if (response.error) {
          setError(response.error);
        } else {
          setImageryResults(response.results);
          setTotalHits(response.totalHits);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsSearching(false);
      }
    },
    [selectedLocation],
  );

  const handleLoadMore = useCallback(async () => {
    if (!lastFilters || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const nextStart = imageryResults.length + 1;
      const response = await searchImagery({ ...lastFilters, startingNumber: nextStart });
      
      if (response.error) {
        setError(response.error);
      } else {
        setImageryResults(prev => [...prev, ...response.results]);
        setTotalHits(response.totalHits);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [lastFilters, imageryResults.length, isLoadingMore]);

  const clearResults = useCallback(() => {
    setImageryResults([]);
    setTotalHits(0);
    setError(null);
  }, []);

  return {
    geocodingResults,
    imageryResults,
    totalHits,
    isGeocoding,
    isSearching,
    isLoadingMore,
    error,
    selectedLocation,
    handleGeocode,
    handleSelectLocation,
    handleSearch,
    handleLoadMore,
    clearResults,
  };
}
