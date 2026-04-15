/**
 * Catalogo de servidores QLDS activos.
 * Fuente unica de verdad — editar SOLO aqui al agregar/quitar servers.
 */
export const SERVER_CATALOG = [
  { id: "ca_1", port: 27960, name: "Clan Arena | HIGH ELO #1" },
  { id: "ca_2", port: 27961, name: "Clan Arena | LOW ELO #1" },
  { id: "ca_3", port: 27968, name: "Clan Arena | ELO LIBRE" },
  { id: "ca_4", port: 27974, name: "Clan Arena | HIGH ELO #2" },
  { id: "ca_5", port: 27969, name: "Clan Arena | LOW ELO #2" },
  { id: "compe_1", port: 27970, name: "Competitivo #1" },
  { id: "compe_2", port: 27971, name: "Competitivo #2" },
  { id: "compe_3", port: 27972, name: "Competitivo #3" },
  { id: "ctf_1", port: 27962, name: "CTF #1" },
  { id: "ctf_2", port: 27963, name: "CTF #2" },
  { id: "duel_1", port: 27964, name: "DUEL #1" },
  { id: "duel_2", port: 27965, name: "DUEL #2" },
  { id: "inf", port: 27967, name: "INF" },
  { id: "lg", port: 27966, name: "LG NOKB" },
  { id: "prc", port: 27973, name: "PRC" },
  { id: "wsr", port: 27975, name: "WSR" },
] as const

export type ServerEntry = (typeof SERVER_CATALOG)[number]
export type ServerId = ServerEntry["id"]
