// Domain entities: core business objects, independent of frameworks and infrastructure.

// El catálogo de sedes sale de los eventos `sede.definida` de Backoffice; no hay métricas por sede acá.
export interface Site {
  id: string;
  name: string;
  // true solo para "Todas las sedes", que agrega al resto.
  isAggregate: boolean;
}

// La sede agregada no se define por evento: existe siempre y va primera en el catálogo.
export const AGGREGATE_SITE: Site = {
  id: "todas-las-sedes",
  name: "Todas las sedes",
  isAggregate: true,
};
