/** Shared by the /api/geocode route and the client that calls it. */
export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
};
