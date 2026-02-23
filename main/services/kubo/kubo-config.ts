/**
 * Конфигурация Kubo демона для Animatrona
 *
 * Порты выбраны так, чтобы не конфликтовать с IPFS Desktop:
 * - IPFS Desktop: API 5001, Gateway 8080, Swarm 4001
 * - Animatrona Kubo: API 5011, Gateway 8081, Swarm 4011
 */

/**
 * Приватный relay сервер для Animatrona
 * Не публикуется в DHT, доступен только пользователям Animatrona
 * Конфигурация: infra/animatrona-relay/
 */
export const PRIVATE_RELAY = '/ip4/193.37.68.73/tcp/41001/p2p/12D3KooWLUL6FhLPLhcyBMcNTXP65225G4H1Ai8HdyvBWi5MKxnh'

/**
 * Порты для embedded Kubo
 */
export const KUBO_PORTS = {
  /** RPC API порт */
  api: 5011,
  /** HTTP Gateway порт */
  gateway: 8081,
  /** Swarm TCP порт */
  swarmTcp: 4011,
  /** Swarm QUIC порт */
  swarmQuic: 4011,
} as const

/**
 * Конфигурация Kubo для Animatrona
 *
 * Настроена для:
 * - DHT client mode (работа за NAT)
 * - Relay client (подключение через relay)
 * - Hole punching (DCUtR)
 * - PubSub для P2P синхронизации
 */
export const KUBO_CONFIG = {
  Addresses: {
    API: `/ip4/127.0.0.1/tcp/${KUBO_PORTS.api}`,
    Gateway: `/ip4/127.0.0.1/tcp/${KUBO_PORTS.gateway}`,
    Swarm: [
      `/ip4/0.0.0.0/tcp/${KUBO_PORTS.swarmTcp}`,
      `/ip4/0.0.0.0/udp/${KUBO_PORTS.swarmQuic}/quic-v1`,
      `/ip4/0.0.0.0/udp/${KUBO_PORTS.swarmQuic}/quic-v1/webtransport`,
    ],
  },

  Bootstrap: [
    // Приватный relay первым — приоритет для Animatrona пользователей
    PRIVATE_RELAY,

    // Публичные bootstrap ноды Protocol Labs
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',

    // Прямые IP адреса (fallback если DNS не работает)
    '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
    '/ip4/147.75.109.213/tcp/4001/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  ],

  Swarm: {
    ConnMgr: {
      LowWater: 50,
      HighWater: 200,
      GracePeriod: '60s',
    },
    RelayClient: {
      Enabled: true,
    },
    RelayService: {
      Enabled: false, // Мы не релей, только клиент
    },
    EnableHolePunching: true,
  },

  Routing: {
    Type: 'dhtclient', // Client mode для работы за NAT
  },

  Pubsub: {
    Enabled: true,
    Router: 'gossipsub',
  },

  // Отключаем mDNS — не нужен для DHT discovery
  Discovery: {
    MDNS: {
      Enabled: false,
    },
  },

  // Peering со специфичными нодами
  Peering: {
    Peers: [
      // Приватный relay как peered node для стабильного соединения
      {
        ID: '12D3KooWLUL6FhLPLhcyBMcNTXP65225G4H1Ai8HdyvBWi5MKxnh',
        Addrs: ['/ip4/193.37.68.73/tcp/41001'],
      },
    ],
  },
} as const

/**
 * Порты IPFS Desktop (для детекции)
 */
export const IPFS_DESKTOP_PORTS = {
  api: 5001,
  gateway: 8080,
  swarm: 4001,
} as const

/**
 * URL для проверки IPFS Desktop API
 */
export const IPFS_DESKTOP_API_URL = `http://127.0.0.1:${IPFS_DESKTOP_PORTS.api}/api/v0`
