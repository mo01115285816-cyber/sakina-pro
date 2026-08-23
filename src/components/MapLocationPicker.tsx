import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, ChevronRight, MapPin } from "lucide-react";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";

// Fix leaflet default icon issue
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const customMarkerIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzJiMWExMCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSAxMGMwIDctOSAxMy05IDEzcy05LTYtOS0xM2E5IDkgMCAwIDEgMTggMHoiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSIzIiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

type Props = {
  initialLat: number;
  initialLon: number;
  onSelect: (cityName: string, lat: number, lon: number) => void;
  onClose: () => void;
};

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  name: string;
};

// Component to handle map clicks and moving the map
function MapEvents({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to programmatically move the map center
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13, { animate: true, duration: 1.5 });
  }, [center, map]);
  return null;
}

export default function MapLocationPicker({
  initialLat,
  initialLon,
  onSelect,
  onClose,
}: Props) {
  const [position, setPosition] = useState<[number, number]>([
    initialLat,
    initialLon,
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [locationName, setLocationName] = useState("جاري التحديد...");

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ar`,
      );
      const data = await res.json();
      if (data && data.address) {
        const city =
          data.address.city ||
          data.address.town ||
          data.address.village ||
          data.address.state ||
          "موقع غير معروف";
        const country = data.address.country || "";
        setLocationName(`${city}، ${country}`);
      } else {
        setLocationName("موقع غير معروف");
      }
    } catch (e) {
      console.warn(e);
      setLocationName("موقع غير معروف");
    }
  }, []);

  useEffect(() => {
    reverseGeocode(initialLat, initialLon);
  }, [initialLat, initialLon, reverseGeocode]);

  const handleLocationSelect = (lat: number, lon: number) => {
    setPosition([lat, lon]);
    setSearchResults([]); // Hide search results if they click on map
    reverseGeocode(lat, lon);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length < 3) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(false);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const [osmRes, arcgisRes] = await Promise.allSettled([
          fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&accept-language=ar`,
          ),
          fetch(
            `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(query)}&maxLocations=5`,
          ),
        ]);

        let combinedResults: SearchResult[] = [];

        if (osmRes.status === "fulfilled") {
          try {
            const osmData = await osmRes.value.json();
            const mappedOsm = osmData.map((item: any) => ({
              display_name: item.display_name,
              lat: item.lat,
              lon: item.lon,
              name: item.name || item.display_name.split(",")[0],
            }));
            combinedResults = [...combinedResults, ...mappedOsm];
          } catch (e) {}
        }

        if (arcgisRes.status === "fulfilled") {
          try {
            const arcgisData = await arcgisRes.value.json();
            if (arcgisData.candidates) {
              const mappedArcgis = arcgisData.candidates.map((item: any) => ({
                display_name: item.address,
                lat: item.location.y.toString(),
                lon: item.location.x.toString(),
                name: item.address.split(",")[0],
              }));

              // Add ArcGIS results if they are not too close to OSM results (to prevent exact duplicates)
              mappedArcgis.forEach((arc: any) => {
                const isDuplicate = combinedResults.some((osm) => {
                  const latDiff = Math.abs(
                    parseFloat(osm.lat) - parseFloat(arc.lat),
                  );
                  const lonDiff = Math.abs(
                    parseFloat(osm.lon) - parseFloat(arc.lon),
                  );
                  return latDiff < 0.01 && lonDiff < 0.01;
                });
                if (!isDuplicate) {
                  combinedResults.push(arc);
                }
              });
            }
          } catch (e) {}
        }

        setSearchResults(combinedResults);
        setHasSearched(true);
        if (combinedResults.length === 0) {
          setTimeout(() => setHasSearched(false), 3000);
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setIsSearching(false);
      }
    }, 600);
  };

  const selectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setPosition([lat, lon]);
    setLocationName(result.name || result.display_name.split(",")[0]);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleConfirm = () => {
    onSelect(locationName, position[0], position[1]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white" dir="rtl">
      {/* Top Header */}
      <div className="absolute top-0 inset-x-0 z-[110] flex items-start justify-between p-4 pt-6 bg-gradient-to-b from-black/40 to-transparent pointer-events-none">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-md text-[#2b1a10] pointer-events-auto active:scale-95 transition-transform shrink-0"
        >
          <ChevronRight size={24} />
        </button>
        <AnimatePresence>
          {hasSearched && searchResults.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#2b1a10]/95 backdrop-blur-sm text-white px-5 py-2.5 rounded-full shadow-lg pointer-events-auto mx-2 flex items-center justify-center"
            >
              <span className="text-[14px] font-bold tracking-wide">
                لم يتم العثور على الموقع
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="w-10 shrink-0" /> {/* Spacer for centering */}
      </div>

      {/* Map Area */}
      <div className="flex-1 relative z-0">
        <MapContainer
          center={position}
          zoom={13}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <Marker position={position} icon={customMarkerIcon} />
          <MapEvents onLocationSelect={handleLocationSelect} />
          <MapController center={position} />
        </MapContainer>
      </div>

      {/* Bottom Panel */}
      <div className="relative z-[110] bg-[#ece7de] rounded-t-[40px] -mt-6 shadow-[0_-8px_30px_rgba(43,26,16,0.08)] px-6 pt-4 pb-8 flex flex-col gap-6 border-t border-[#e6dccf]">
        <div className="w-12 h-1.5 bg-[#c2b5a3] rounded-full mx-auto" />

        <div className="text-center">
          <h2 className="text-[22px] font-bold text-[#2b1a10]">
            اختيار المدينة
          </h2>
        </div>

        <div className="relative">
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7f6a55]">
            <Search size={20} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="مثال: المدينة المنورة، السعودية"
            className="w-full bg-[#fdfcfb] border border-[#e6dccf] rounded-[20px] py-4 pr-12 pl-4 text-[15px] font-bold text-[#2b1a10] placeholder-[#7f6a55]/60 focus:outline-none focus:border-[#b88a4f] focus:ring-1 focus:ring-[#b88a4f] transition-all"
          />
          {isSearching && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <SakeenahLineSpinner size={16} color="#b88a4f" label="جارٍ البحث" />
            </div>
          )}

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-[#fdfcfb] rounded-[16px] shadow-xl border border-[#e6dccf] max-h-[200px] overflow-y-auto z-50"
              >
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSearchResult(result)}
                    className="w-full text-right px-4 py-3 border-b border-[#e6dccf] last:border-0 hover:bg-[#f7f2ea] flex items-center gap-3"
                  >
                    <MapPin size={16} className="text-[#b88a4f] shrink-0" />
                    <span className="text-[14px] font-semibold text-[#2b1a10] truncate">
                      {result.display_name}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}

            {/* No bottom error message here, it is displayed as a top capsule */}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <MapPin size={16} className="text-[#b88a4f]" />
          <p className="text-[15px] font-bold text-[#2b1a10]">{locationName}</p>
        </div>

        <button
          onClick={handleConfirm}
          className="w-full bg-[#2b1a10] text-white rounded-[24px] py-4 text-[16px] font-bold active:scale-[0.98] transition-transform shadow-[0_8px_20px_rgba(43,26,16,0.25)]"
        >
          اختيار الموقع
        </button>
      </div>
    </div>
  );
}
