import 'leaflet'

declare module 'leaflet' {
  function markerClusterGroup(options?: any): any
  function heatLayer(latlngs: any[], options?: any): any
}
