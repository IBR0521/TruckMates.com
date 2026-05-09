export {}

declare global {
  namespace google {
    namespace maps {
      type LatLngLiteral = { lat: number; lng: number }
      type GeocoderAddressComponent = any
      type DirectionsWaypoint = any
      type DirectionsRequest = any
      type DirectionsResult = any
      type DirectionsStatus = any
      type DirectionsLeg = any

      class Map {
        constructor(...args: any[])
        setCenter(...args: any[]): void
        setZoom(...args: any[]): void
        fitBounds(...args: any[]): void
      }
      class Marker {
        constructor(...args: any[])
        addListener(...args: any[]): any
        setMap(...args: any[]): void
      }
      class InfoWindow {
        constructor(...args: any[])
        open(...args: any[]): void
        close(...args: any[]): void
        getMap(...args: any[]): any
        setContent(...args: any[]): void
        setPosition(...args: any[]): void
      }
      class Circle {
        constructor(...args: any[])
        addListener(...args: any[]): any
        setMap(...args: any[]): void
      }
      class Rectangle {
        constructor(...args: any[])
        addListener(...args: any[]): any
        getBounds(...args: any[]): any
        setMap(...args: any[]): void
      }
      class Polygon {
        constructor(...args: any[])
        addListener(...args: any[]): any
        getPath(...args: any[]): any
        setMap(...args: any[]): void
      }
      class LatLng {
        constructor(...args: any[])
      }
      class LatLngBounds {
        constructor(...args: any[])
        extend(...args: any[]): void
        getCenter(...args: any[]): any
      }
      class Geocoder {
        constructor(...args: any[])
        geocode(...args: any[]): void
      }
      class DirectionsService {
        constructor(...args: any[])
        route(...args: any[]): void
      }
      class DirectionsRenderer {
        constructor(...args: any[])
        setDirections(...args: any[]): void
      }

      const TravelMode: any
      const SymbolPath: any
      const DirectionsStatus: any
      const MapTypeId: any
      const event: any

      namespace places {
        type PlaceResult = any
        type AutocompletePrediction = any
        type AutocompleteResponse = any
        type PlacesServiceStatus = any

        class AutocompleteService {
          constructor(...args: any[])
          getPlacePredictions(...args: any[]): void
        }
        class Autocomplete {
          constructor(...args: any[])
        }
        class PlacesService {
          constructor(...args: any[])
          getDetails(...args: any[]): void
        }

        const PlacesServiceStatus: any
      }
    }
  }
}
