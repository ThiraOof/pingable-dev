// Answer-key solutions for the lab-test harness, keyed by `slug/moduleOrder/lessonOrder`.
// Each value: { settleMs?, regradeMs?, bootTimeoutMs?, groups: [{ node, commands[] }] }.
// VyOS groups wrap their own configure/commit/exit; VPCS (PC*) commands run raw.
// {{TOKEN}} are interpolated with the lab's rolled vars before injection.
//
// These are the *solutions* (they make grading pass) — never ship to learners.

import crypto from 'node:crypto';

// Raw 32-byte base64 x25519 keypair, WireGuard-compatible (wg clamps internally).
function wgKeypair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519');
  const priv = privateKey.export({ type: 'pkcs8', format: 'der' });
  const pub = publicKey.export({ type: 'spki', format: 'der' });
  return {
    priv: priv.subarray(priv.length - 32).toString('base64'),
    pub: pub.subarray(pub.length - 32).toString('base64'),
  };
}

const cfg = (...lines) => ['configure', ...lines, 'commit', 'exit'];

function wireguardSolution() {
  const r1 = wgKeypair();
  const r2 = wgKeypair();
  return {
    settleMs: 15000,
    regradeMs: 15000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set interfaces wireguard wg0 address 172.16.0.1/30',
        `set interfaces wireguard wg0 private-key ${r1.priv}`,
        'set interfaces wireguard wg0 port 51820',
        `set interfaces wireguard wg0 peer R2 public-key ${r2.pub}`,
        'set interfaces wireguard wg0 peer R2 address 10.0.12.2',
        'set interfaces wireguard wg0 peer R2 port 51820',
        'set interfaces wireguard wg0 peer R2 allowed-ips 172.16.0.0/30',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set interfaces wireguard wg0 address 172.16.0.2/30',
        `set interfaces wireguard wg0 private-key ${r2.priv}`,
        'set interfaces wireguard wg0 port 51820',
        `set interfaces wireguard wg0 peer R1 public-key ${r1.pub}`,
        'set interfaces wireguard wg0 peer R1 address 10.0.12.1',
        'set interfaces wireguard wg0 peer R1 port 51820',
        'set interfaces wireguard wg0 peer R1 allowed-ips 172.16.0.0/30',
      ) },
    ],
  };
}

export const SOLUTIONS = {
  // ─────────────────── network-troubleshooting (all troubleshoot) ───────────────────
  'network-troubleshooting/0/1': { // ซ่อม #1 link disabled
    settleMs: 5000,
    groups: [{ node: 'R1', commands: cfg('delete interfaces ethernet eth1 disable') }],
  },
  'network-troubleshooting/0/2': { // ซ่อม #2 BGP remote-as (bounce eth1 to clear stale session)
    settleMs: 20000, regradeMs: 20000,
    groups: [{ node: 'R1', commands: [
      'configure',
      'set protocols bgp neighbor 10.0.12.2 remote-as 65002',
      'set interfaces ethernet eth1 disable', 'commit',
      'delete interfaces ethernet eth1 disable', 'commit',
      'exit',
    ] }],
  },
  'network-troubleshooting/0/3': { // ซ่อม #3 NAT source addr
    settleMs: 8000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1'] },
      { node: 'R1', commands: cfg('set nat source rule 100 source address 192.168.1.0/24') },
    ],
  },
  'network-troubleshooting/0/4': { // mystery: link disabled ({{NET}})
    settleMs: 6000,
    groups: [{ node: 'R1', commands: cfg('delete interfaces ethernet eth1 disable') }],
  },
  'network-troubleshooting/0/5': { // ซ่อม #6 DHCP relay
    settleMs: 12000, regradeMs: 12000,
    groups: [
      { node: 'R1', commands: cfg(
        'set service dhcp-relay server 10.0.12.2',
        'delete service dhcp-relay server 10.0.12.99',
      ) },
      { node: 'PC1', commands: ['dhcp'] },
    ],
  },
  'network-troubleshooting/0/6': { // ซ่อม #7 IPsec PSK mismatch (Tier A #1)
    settleMs: 35000, regradeMs: 25000,
    groups: [
      { node: 'R1', commands: cfg('set vpn ipsec authentication psk PR secret SAME-KEY-123') },
      { node: 'R2', commands: cfg('set vpn ipsec authentication psk PR secret SAME-KEY-123') },
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1'] },
      { node: 'PC2', commands: ['ip 192.168.2.10 255.255.255.0 192.168.2.1'] },
    ],
  },
  'network-troubleshooting/1/0': { // ซ่อม #4 VLAN vif mismatch
    settleMs: 8000,
    groups: [{ node: 'R2', commands: cfg(
      'delete interfaces ethernet eth1 vif 20',
      'set interfaces ethernet eth1 vif 10 address 10.0.10.2/24',
    ) }],
  },
  'network-troubleshooting/1/1': { // ซ่อม #5 GRE remote
    settleMs: 10000,
    groups: [{ node: 'R1', commands: cfg('set interfaces tunnel tun0 remote 10.0.12.2') }],
  },
  'network-troubleshooting/1/2': { // BOSS 3-fault (Tier A #4)
    settleMs: 10000, regradeMs: 10000,
    groups: [
      { node: 'R1', commands: cfg(
        'delete interfaces ethernet eth2 disable',
        'set protocols static route 192.168.2.0/24 next-hop 10.0.12.2',
      ) },
      { node: 'R2', commands: cfg('set protocols static route 192.168.1.0/24 next-hop 10.0.12.1') },
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1'] },
    ],
  },

  // ─────────────────── network-security ───────────────────
  'network-security/1/1': { // Zone-Based Firewall (Tier A #6)
    settleMs: 8000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1'] },
      { node: 'PC2', commands: ['ip 203.0.113.10 255.255.255.0 203.0.113.1'] },
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.1.1/24',
        'set interfaces ethernet eth2 address 203.0.113.1/24',
        'set firewall ipv4 name LAN-WAN default-action drop',
        'set firewall ipv4 name LAN-WAN rule 10 action accept',
        'set firewall ipv4 name LAN-WAN rule 10 state new',
        'set firewall ipv4 name WAN-LAN default-action drop',
        'set firewall ipv4 name WAN-LAN rule 10 action accept',
        'set firewall ipv4 name WAN-LAN rule 10 state established',
        'set firewall ipv4 name WAN-LAN rule 10 state related',
        'set firewall zone LAN member interface eth1',
        'set firewall zone WAN member interface eth2',
        'set firewall zone LAN default-action drop',
        'set firewall zone WAN default-action drop',
        'set firewall zone WAN from LAN firewall name LAN-WAN',
        'set firewall zone LAN from WAN firewall name WAN-LAN',
      ) },
    ],
  },
  'network-security/2/1': { // IPsec Site-to-Site (Tier A #2) — VyOS 1.5 syntax (peer NAME + remote-address)
    settleMs: 40000, regradeMs: 30000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1'] },
      { node: 'PC2', commands: ['ip 192.168.2.10 255.255.255.0 192.168.2.1'] },
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.1.1/24',
        'set interfaces ethernet eth2 address 10.0.12.1/24',
        'set vpn ipsec interface eth2',
        'set vpn ipsec ike-group IKE key-exchange ikev2',
        'set vpn ipsec ike-group IKE proposal 1 encryption aes256',
        'set vpn ipsec ike-group IKE proposal 1 hash sha256',
        'set vpn ipsec ike-group IKE proposal 1 dh-group 14',
        'set vpn ipsec esp-group ESP proposal 1 encryption aes256',
        'set vpn ipsec esp-group ESP proposal 1 hash sha256',
        'set vpn ipsec authentication psk PSK1 id 10.0.12.1',
        'set vpn ipsec authentication psk PSK1 id 10.0.12.2',
        'set vpn ipsec authentication psk PSK1 secret MYSECRET123',
        'set vpn ipsec site-to-site peer PEER1 authentication mode pre-shared-secret',
        'set vpn ipsec site-to-site peer PEER1 authentication local-id 10.0.12.1',
        'set vpn ipsec site-to-site peer PEER1 authentication remote-id 10.0.12.2',
        'set vpn ipsec site-to-site peer PEER1 remote-address 10.0.12.2',
        'set vpn ipsec site-to-site peer PEER1 local-address 10.0.12.1',
        'set vpn ipsec site-to-site peer PEER1 ike-group IKE',
        'set vpn ipsec site-to-site peer PEER1 default-esp-group ESP',
        'set vpn ipsec site-to-site peer PEER1 tunnel 1 local prefix 192.168.1.0/24',
        'set vpn ipsec site-to-site peer PEER1 tunnel 1 remote prefix 192.168.2.0/24',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set interfaces ethernet eth2 address 192.168.2.1/24',
        'set vpn ipsec interface eth1',
        'set vpn ipsec ike-group IKE key-exchange ikev2',
        'set vpn ipsec ike-group IKE proposal 1 encryption aes256',
        'set vpn ipsec ike-group IKE proposal 1 hash sha256',
        'set vpn ipsec ike-group IKE proposal 1 dh-group 14',
        'set vpn ipsec esp-group ESP proposal 1 encryption aes256',
        'set vpn ipsec esp-group ESP proposal 1 hash sha256',
        'set vpn ipsec authentication psk PSK1 id 10.0.12.1',
        'set vpn ipsec authentication psk PSK1 id 10.0.12.2',
        'set vpn ipsec authentication psk PSK1 secret MYSECRET123',
        'set vpn ipsec site-to-site peer PEER1 authentication mode pre-shared-secret',
        'set vpn ipsec site-to-site peer PEER1 authentication local-id 10.0.12.2',
        'set vpn ipsec site-to-site peer PEER1 authentication remote-id 10.0.12.1',
        'set vpn ipsec site-to-site peer PEER1 remote-address 10.0.12.1',
        'set vpn ipsec site-to-site peer PEER1 local-address 10.0.12.2',
        'set vpn ipsec site-to-site peer PEER1 ike-group IKE',
        'set vpn ipsec site-to-site peer PEER1 default-esp-group ESP',
        'set vpn ipsec site-to-site peer PEER1 tunnel 1 local prefix 192.168.2.0/24',
        'set vpn ipsec site-to-site peer PEER1 tunnel 1 remote prefix 192.168.1.0/24',
      ) },
    ],
  },
  'network-security/3/1': wireguardSolution(), // WireGuard (Tier A #3)
  'network-security/5/1': { // SSH Hardening + Banner
    settleMs: 6000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1'] },
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.1.1/24',
        'set service ssh port 22',
        'set service ssh listen-address 192.168.1.1',
        'set service ssh disable-password-authentication',
        'set system login banner pre-login "WARNING: Authorized access only."',
      ) },
    ],
  },

  // ─────────────────── ospf-hands-on ───────────────────
  'ospf-hands-on/0/1': { // Single Area
    settleMs: 30000, regradeMs: 20000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set interfaces dummy dum0 address 192.168.1.1/24',
        'set protocols ospf parameters router-id 1.1.1.1',
        'set protocols ospf area 0 network 10.0.12.0/24',
        'set protocols ospf area 0 network 192.168.1.0/24',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set interfaces dummy dum0 address 192.168.2.1/24',
        'set protocols ospf parameters router-id 2.2.2.2',
        'set protocols ospf area 0 network 10.0.12.0/24',
        'set protocols ospf area 0 network 192.168.2.0/24',
      ) },
    ],
  },
  'ospf-hands-on/1/0': { // Multi-Area + ABR
    settleMs: 35000, regradeMs: 20000, bootTimeoutMs: 360000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set interfaces dummy dum0 address 192.168.1.1/24',
        'set protocols ospf parameters router-id 1.1.1.1',
        'set protocols ospf area 1 network 10.0.12.0/24',
        'set protocols ospf area 1 network 192.168.1.0/24',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set interfaces ethernet eth2 address 10.0.23.2/24',
        'set protocols ospf parameters router-id 2.2.2.2',
        'set protocols ospf area 1 network 10.0.12.0/24',
        'set protocols ospf area 0 network 10.0.23.0/24',
      ) },
      { node: 'R3', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.23.3/24',
        'set interfaces dummy dum0 address 192.168.3.1/24',
        'set protocols ospf parameters router-id 3.3.3.3',
        'set protocols ospf area 0 network 10.0.23.0/24',
        'set protocols ospf area 0 network 192.168.3.0/24',
      ) },
    ],
  },
  'ospf-hands-on/2/1': { // Stub Area
    settleMs: 35000, regradeMs: 20000, bootTimeoutMs: 360000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set interfaces dummy dum0 address 192.168.1.1/24',
        'set protocols ospf parameters router-id 1.1.1.1',
        'set protocols ospf area 1 network 10.0.12.0/24',
        'set protocols ospf area 1 network 192.168.1.0/24',
        'set protocols ospf area 1 area-type stub',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set interfaces ethernet eth2 address 10.0.23.2/24',
        'set protocols ospf parameters router-id 2.2.2.2',
        'set protocols ospf area 1 network 10.0.12.0/24',
        'set protocols ospf area 0 network 10.0.23.0/24',
        'set protocols ospf area 1 area-type stub',
      ) },
      { node: 'R3', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.23.3/24',
        'set interfaces dummy dum0 address 192.168.3.1/24',
        'set protocols ospf parameters router-id 3.3.3.3',
        'set protocols ospf area 0 network 10.0.23.0/24',
        'set protocols ospf area 0 network 192.168.3.0/24',
      ) },
    ],
  },
  'ospf-hands-on/3/0': { // Redistribute Connected
    settleMs: 30000, regradeMs: 20000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set interfaces dummy dum1 address 172.16.50.1/24',
        'set protocols ospf parameters router-id 1.1.1.1',
        'set protocols ospf area 0 network 10.0.12.0/24',
        'set protocols ospf redistribute connected',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set protocols ospf parameters router-id 2.2.2.2',
        'set protocols ospf area 0 network 10.0.12.0/24',
      ) },
    ],
  },
  // FRR keeps the stale (mismatched) adjacency after the param fix; bounce eth1
  // to force OSPF to re-form on it (known-good syntax vs op-mode reset).
  'ospf-hands-on/4/1': { // troubleshoot #1 area mismatch
    settleMs: 30000, regradeMs: 20000,
    groups: [{ node: 'R2', commands: [
      'configure',
      'delete protocols ospf area 1 network 10.0.12.0/24',
      'set protocols ospf area 0 network 10.0.12.0/24',
      'set interfaces ethernet eth1 disable', 'commit',
      'delete interfaces ethernet eth1 disable', 'commit',
      'exit',
    ] }],
  },
  'ospf-hands-on/4/2': { // troubleshoot #2 hello timer
    settleMs: 30000, regradeMs: 20000,
    groups: [{ node: 'R2', commands: [
      'configure',
      'delete protocols ospf interface eth1 hello-interval',
      'set interfaces ethernet eth1 disable', 'commit',
      'delete interfaces ethernet eth1 disable', 'commit',
      'exit',
    ] }],
  },
  'ospf-hands-on/4/3': { // Boss ExStart MTU + missing network (Tier A #5)
    settleMs: 35000, regradeMs: 25000,
    groups: [{ node: 'R2', commands: cfg(
      'set interfaces ethernet eth1 mtu 1500',
      'set protocols ospf area 0 network 192.168.2.0/24',
    ) }],
  },

  // ─────────────────── ccnp-advanced-routing (DHCP/NAT/BGP/ACL/GRE) ───────────────────
  'ccnp-advanced-routing/2/0': { // DHCP server
    settleMs: 12000, regradeMs: 12000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.10.1/24',
        'set service dhcp-server shared-network-name LAN subnet 192.168.10.0/24 subnet-id 1',
        'set service dhcp-server shared-network-name LAN subnet 192.168.10.0/24 range R1 start 192.168.10.100',
        'set service dhcp-server shared-network-name LAN subnet 192.168.10.0/24 range R1 stop 192.168.10.200',
        'set service dhcp-server shared-network-name LAN subnet 192.168.10.0/24 option default-router 192.168.10.1',
      ) },
      { node: 'PC1', commands: ['dhcp'] },
    ],
  },
  'ccnp-advanced-routing/2/1': { // DHCP relay
    settleMs: 12000, regradeMs: 12000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.50.1/24',
        'set interfaces ethernet eth2 address 10.0.12.1/30',
        'set service dhcp-relay server 10.0.12.2',
        'set service dhcp-relay interface eth1',
        'set service dhcp-relay interface eth2',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/30',
        'set service dhcp-server listen-address 10.0.12.2',
        'set service dhcp-server shared-network-name LAN subnet 192.168.50.0/24 subnet-id 1',
        'set service dhcp-server shared-network-name LAN subnet 192.168.50.0/24 range R1 start 192.168.50.100',
        'set service dhcp-server shared-network-name LAN subnet 192.168.50.0/24 range R1 stop 192.168.50.200',
        'set service dhcp-server shared-network-name LAN subnet 192.168.50.0/24 option default-router 192.168.50.1',
        'set protocols static route 192.168.50.0/24 next-hop 10.0.12.1',
      ) },
      { node: 'PC1', commands: ['dhcp'] },
    ],
  },
  'ccnp-advanced-routing/2/2': { // Static NAT
    settleMs: 10000, regradeMs: 8000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.1.1/24',
        'set interfaces ethernet eth2 address 10.0.12.1/30',
        'set nat source rule 10 source address 192.168.1.10',
        'set nat source rule 10 outbound-interface name eth2',
        'set nat source rule 10 translation address 203.0.113.10',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/30',
        'set protocols static route 203.0.113.0/24 next-hop 10.0.12.1',
      ) },
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1', 'ping 10.0.12.2'] },
    ],
  },
  'ccnp-advanced-routing/2/3': { // Dynamic NAT pool
    settleMs: 10000, regradeMs: 8000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.1.1/24',
        'set interfaces ethernet eth2 address 10.0.12.1/30',
        'set nat source rule 20 source address 192.168.1.0/24',
        'set nat source rule 20 outbound-interface name eth2',
        'set nat source rule 20 translation address 203.0.113.10-203.0.113.20',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/30',
        'set protocols static route 203.0.113.0/24 next-hop 10.0.12.1',
      ) },
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1', 'ping 10.0.12.2'] },
      { node: 'PC2', commands: ['ip 192.168.1.20 255.255.255.0 192.168.1.1', 'ping 10.0.12.2'] },
    ],
  },
  'ccnp-advanced-routing/2/4': { // PAT masquerade
    settleMs: 10000, regradeMs: 8000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.1.1/24',
        'set interfaces ethernet eth2 address 10.0.12.1/30',
        'set nat source rule 100 source address 192.168.1.0/24',
        'set nat source rule 100 outbound-interface name eth2',
        'set nat source rule 100 translation address masquerade',
      ) },
      { node: 'R2', commands: cfg('set interfaces ethernet eth1 address 10.0.12.2/30') },
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1', 'ping 10.0.12.2'] },
      { node: 'PC2', commands: ['ip 192.168.1.20 255.255.255.0 192.168.1.1', 'ping 10.0.12.2'] },
    ],
  },
  'ccnp-advanced-routing/3/0': { // eBGP
    settleMs: 25000, regradeMs: 20000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set interfaces dummy dum0 address 192.168.1.1/24',
        'set protocols bgp system-as 65001',
        'set protocols bgp neighbor 10.0.12.2 remote-as 65002',
        'set protocols bgp neighbor 10.0.12.2 address-family ipv4-unicast',
        'set protocols bgp address-family ipv4-unicast network 192.168.1.0/24',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set interfaces dummy dum0 address 192.168.2.1/24',
        'set protocols bgp system-as 65002',
        'set protocols bgp neighbor 10.0.12.1 remote-as 65001',
        'set protocols bgp neighbor 10.0.12.1 address-family ipv4-unicast',
        'set protocols bgp address-family ipv4-unicast network 192.168.2.0/24',
      ) },
    ],
  },
  'ccnp-advanced-routing/3/1': { // BGP Route Reflector (3×VyOS + SW)
    settleMs: 30000, regradeMs: 25000, bootTimeoutMs: 360000,
    groups: [
      { node: 'RR', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.0.1/24',
        'set protocols bgp system-as 65010',
        'set protocols bgp neighbor 10.0.0.2 remote-as 65010',
        'set protocols bgp neighbor 10.0.0.2 address-family ipv4-unicast route-reflector-client',
        'set protocols bgp neighbor 10.0.0.3 remote-as 65010',
        'set protocols bgp neighbor 10.0.0.3 address-family ipv4-unicast route-reflector-client',
      ) },
      { node: 'C1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.0.2/24',
        'set interfaces dummy dum0 address 192.168.1.1/24',
        'set protocols bgp system-as 65010',
        'set protocols bgp neighbor 10.0.0.1 remote-as 65010',
        'set protocols bgp neighbor 10.0.0.1 address-family ipv4-unicast',
        'set protocols bgp address-family ipv4-unicast network 192.168.1.0/24',
      ) },
      { node: 'C2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.0.3/24',
        'set interfaces dummy dum0 address 192.168.2.1/24',
        'set protocols bgp system-as 65010',
        'set protocols bgp neighbor 10.0.0.1 remote-as 65010',
        'set protocols bgp neighbor 10.0.0.1 address-family ipv4-unicast',
        'set protocols bgp address-family ipv4-unicast network 192.168.2.0/24',
      ) },
    ],
  },
  'ccnp-advanced-routing/3/2': { // BGP Route Map (prefix-list filter)
    settleMs: 25000, regradeMs: 20000,
    groups: [
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set interfaces dummy dum0 address 192.168.2.1/24',
        'set interfaces dummy dum1 address 192.168.20.1/24',
        'set protocols bgp system-as 65002',
        'set protocols bgp neighbor 10.0.12.1 remote-as 65001',
        'set protocols bgp neighbor 10.0.12.1 address-family ipv4-unicast',
        'set protocols bgp address-family ipv4-unicast network 192.168.2.0/24',
        'set protocols bgp address-family ipv4-unicast network 192.168.20.0/24',
      ) },
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set protocols bgp system-as 65001',
        'set protocols bgp neighbor 10.0.12.2 remote-as 65002',
        'set policy prefix-list ALLOW rule 10 action permit',
        'set policy prefix-list ALLOW rule 10 prefix 192.168.2.0/24',
        'set policy route-map FROM-R2 rule 10 action permit',
        'set policy route-map FROM-R2 rule 10 match ip address prefix-list ALLOW',
        'set protocols bgp neighbor 10.0.12.2 address-family ipv4-unicast route-map import FROM-R2',
      ) },
    ],
  },
  'ccnp-advanced-routing/3/3': { // Extended ACL (ruleset only; ICMP routed across R1)
    settleMs: 10000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1'] },
      { node: 'PC2', commands: ['ip 192.168.2.10 255.255.255.0 192.168.2.1'] },
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.1.1/24',
        'set interfaces ethernet eth2 address 192.168.2.1/24',
        'set firewall ipv4 name AtoB default-action accept',
        'set firewall ipv4 name AtoB rule 10 action accept',
        'set firewall ipv4 name AtoB rule 10 protocol icmp',
        'set firewall ipv4 name AtoB rule 20 action drop',
        'set firewall ipv4 name AtoB rule 20 protocol tcp',
        'set firewall ipv4 name AtoB rule 20 destination port 23',
      ) },
    ],
  },
  'ccnp-advanced-routing/3/4': { // GRE Tunnel
    settleMs: 12000, regradeMs: 8000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set interfaces tunnel tun0 encapsulation gre',
        'set interfaces tunnel tun0 address 172.16.0.1/30',
        'set interfaces tunnel tun0 source-address 10.0.12.1',
        'set interfaces tunnel tun0 remote 10.0.12.2',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set interfaces tunnel tun0 encapsulation gre',
        'set interfaces tunnel tun0 address 172.16.0.2/30',
        'set interfaces tunnel tun0 source-address 10.0.12.2',
        'set interfaces tunnel tun0 remote 10.0.12.1',
      ) },
    ],
  },

  // ─────────────────── ccnp-core (L2 switching + FHRP/mgmt) ───────────────────
  'ccnp-core/2/0': { // VLAN 802.1Q
    settleMs: 10000, regradeMs: 8000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 vif 10 address 10.0.10.1/24',
        'set interfaces ethernet eth1 vif 20 address 10.0.20.1/24',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 vif 10 address 10.0.10.2/24',
        'set interfaces ethernet eth1 vif 20 address 10.0.20.2/24',
      ) },
    ],
  },
  // ccnp-core/2/1 Inter-VLAN RoaS — needs SW1 access/trunk ports (GNS3 switch config); see switchPorts.
  'ccnp-core/2/1': {
    settleMs: 12000, regradeMs: 8000,
    switchPorts: { node: 'SW1', ports: [
      { port: 0, type: 'access', vlan: 10 },
      { port: 1, type: 'access', vlan: 20 },
      { port: 2, type: 'dot1q', vlan: 1 },
    ] },
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 vif 10 address 10.0.10.1/24',
        'set interfaces ethernet eth1 vif 20 address 10.0.20.1/24',
      ) },
      { node: 'PC1', commands: ['ip 10.0.10.10 255.255.255.0 10.0.10.1'] },
      { node: 'PC2', commands: ['ip 10.0.20.10 255.255.255.0 10.0.20.1'] },
    ],
  },
  'ccnp-core/2/2': { // EtherChannel LACP bond (VyOS 1.5: member interface, not bond-group)
    settleMs: 15000, regradeMs: 10000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces bonding bond0 mode 802.3ad',
        'set interfaces bonding bond0 member interface eth1',
        'set interfaces bonding bond0 member interface eth2',
        'set interfaces bonding bond0 address 10.0.12.1/24',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces bonding bond0 mode 802.3ad',
        'set interfaces bonding bond0 member interface eth1',
        'set interfaces bonding bond0 member interface eth2',
        'set interfaces bonding bond0 address 10.0.12.2/24',
      ) },
    ],
  },
  'ccnp-core/2/3': { // PortFast / STP bridge (VyOS 1.5: `stp` valueless)
    settleMs: 45000, regradeMs: 20000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces bridge br0 stp',
        'set interfaces bridge br0 member interface eth1',
        'set interfaces bridge br0 member interface eth2',
      ) },
      { node: 'PC1', commands: ['ip 10.0.0.11 255.255.255.0'] },
      { node: 'PC2', commands: ['ip 10.0.0.12 255.255.255.0'] },
    ],
  },
  'ccnp-core/2/4': { // Port Security (MAC filter) — capture PC1 MAC
    settleMs: 8000,
    capture: [{ node: 'PC1', command: 'show ip', regex: '(([0-9a-f]{2}:){5}[0-9a-f]{2})', var: 'PCMAC' }],
    groups: [
      { node: 'PC1', commands: ['ip 10.0.0.11 255.255.255.0 10.0.0.1'] },
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.0.1/24',
        'set firewall ipv4 name PORTSEC default-action drop',
        'set firewall ipv4 name PORTSEC rule 10 action accept',
        'set firewall ipv4 name PORTSEC rule 10 source mac-address {{PCMAC}}',
      ) },
    ],
  },
  'ccnp-core/2/5': { // Local SPAN (config only)
    settleMs: 6000,
    groups: [{ node: 'R1', commands: cfg('set interfaces ethernet eth2 mirror ingress eth1') }],
  },
  'ccnp-core/3/0': { // VRRP
    settleMs: 15000, regradeMs: 10000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.0.2/24',
        'set high-availability vrrp group GW vrid 10',
        'set high-availability vrrp group GW interface eth1',
        'set high-availability vrrp group GW address 10.0.0.1/24',
        'set high-availability vrrp group GW priority 150',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.0.3/24',
        'set high-availability vrrp group GW vrid 10',
        'set high-availability vrrp group GW interface eth1',
        'set high-availability vrrp group GW address 10.0.0.1/24',
        'set high-availability vrrp group GW priority 100',
      ) },
      { node: 'PC1', commands: ['ip 10.0.0.100 255.255.255.0 10.0.0.1'] },
    ],
  },
  'ccnp-core/3/1': { // HSRP-as-VRRP (vrid 11, preempt default)
    settleMs: 15000, regradeMs: 10000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.0.2/24',
        'set high-availability vrrp group GW vrid 11',
        'set high-availability vrrp group GW interface eth1',
        'set high-availability vrrp group GW address 10.0.0.1/24',
        'set high-availability vrrp group GW priority 150',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.0.3/24',
        'set high-availability vrrp group GW vrid 11',
        'set high-availability vrrp group GW interface eth1',
        'set high-availability vrrp group GW address 10.0.0.1/24',
        'set high-availability vrrp group GW priority 100',
      ) },
      { node: 'PC1', commands: ['ip 10.0.0.100 255.255.255.0 10.0.0.1'] },
    ],
  },
  'ccnp-core/3/2': { // SSH
    settleMs: 6000,
    groups: [{ node: 'R1', commands: cfg(
      'set interfaces ethernet eth1 address 10.0.0.1/24',
      'set service ssh port 22',
      'set system login user netadmin authentication plaintext-password Netadmin123!',
    ) }],
  },
  'ccnp-core/3/3': { // Syslog (VyOS 1.5: `remote`, not `host`) — grading expect also needs update in seed
    settleMs: 6000,
    groups: [{ node: 'R1', commands: cfg(
      'set interfaces ethernet eth1 address 10.0.0.1/24',
      'set system syslog remote 10.0.0.50 facility all level info',
    ) }],
  },

  // ─────────────────── ip-services ───────────────────
  'ip-services/0/1': { // DNS forwarder + static host mapping
    settleMs: 10000, regradeMs: 8000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.1.10 255.255.255.0 192.168.1.1'] },
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 192.168.1.1/24',
        'set service dns forwarding listen-address 192.168.1.1',
        'set service dns forwarding allow-from 192.168.1.0/24',
        'set service dns forwarding name-server 1.1.1.1',
        'set system static-host-mapping host-name server1 inet 192.168.1.10',
      ) },
    ],
  },
  'ip-services/1/1': { // NTP client+server
    settleMs: 12000, regradeMs: 10000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set service ntp server 10.0.12.2',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.2/24',
        'set service ntp allow-client address 10.0.12.0/24',
        'set service ntp listen-address 10.0.12.2',
      ) },
    ],
  },
  'ip-services/4/1': { // Traffic shaping
    settleMs: 10000, regradeMs: 8000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 10.0.12.1/24',
        'set qos policy shaper WAN-OUT bandwidth 10mbit',
        'set qos policy shaper WAN-OUT default bandwidth 50%',
        'set qos policy shaper WAN-OUT class 10 match VOICE ip dscp EF',
        'set qos policy shaper WAN-OUT class 10 bandwidth 30%',
        'set qos interface eth1 egress WAN-OUT',
      ) },
      { node: 'R2', commands: cfg('set interfaces ethernet eth1 address 10.0.12.2/24') },
    ],
  },

  // ─────────────────── ipv6-deep-dive ───────────────────
  'ipv6-deep-dive/0/1': { // IPv6 addressing + ping6
    settleMs: 12000, regradeMs: 8000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 2001:db8:12::1/64',
        'set interfaces dummy dum0 address 2001:db8:1::1/64',
        'set protocols static route6 2001:db8:2::/64 next-hop 2001:db8:12::2',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 2001:db8:12::2/64',
        'set interfaces dummy dum0 address 2001:db8:2::1/64',
        'set protocols static route6 2001:db8:1::/64 next-hop 2001:db8:12::1',
      ) },
    ],
  },
  'ipv6-deep-dive/1/1': { // Static route6 across 3 routers
    settleMs: 15000, regradeMs: 10000, bootTimeoutMs: 360000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces dummy dum0 address 2001:db8:1::1/64',
        'set interfaces ethernet eth1 address 2001:db8:12::1/64',
        'set protocols static route6 2001:db8:3::/64 next-hop 2001:db8:12::2',
        'set protocols static route6 2001:db8:23::/64 next-hop 2001:db8:12::2',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 2001:db8:12::2/64',
        'set interfaces ethernet eth2 address 2001:db8:23::2/64',
        'set protocols static route6 2001:db8:1::/64 next-hop 2001:db8:12::1',
        'set protocols static route6 2001:db8:3::/64 next-hop 2001:db8:23::3',
      ) },
      { node: 'R3', commands: cfg(
        'set interfaces ethernet eth1 address 2001:db8:23::3/64',
        'set interfaces dummy dum0 address 2001:db8:3::1/64',
        'set protocols static route6 2001:db8:1::/64 next-hop 2001:db8:23::2',
        'set protocols static route6 2001:db8:12::/64 next-hop 2001:db8:23::2',
      ) },
    ],
  },
  'ipv6-deep-dive/2/1': { // OSPFv3
    settleMs: 30000, regradeMs: 25000,
    groups: [
      { node: 'R1', commands: cfg(
        'set interfaces ethernet eth1 address 2001:db8:12::1/64',
        'set interfaces dummy dum0 address 2001:db8:1::1/64',
        'set protocols ospfv3 parameters router-id 1.1.1.1',
        'set protocols ospfv3 interface eth1 area 0',
        'set protocols ospfv3 interface dum0 area 0',
      ) },
      { node: 'R2', commands: cfg(
        'set interfaces ethernet eth1 address 2001:db8:12::2/64',
        'set interfaces dummy dum0 address 2001:db8:2::1/64',
        'set protocols ospfv3 parameters router-id 2.2.2.2',
        'set protocols ospfv3 interface eth1 area 0',
        'set protocols ospfv3 interface dum0 area 0',
      ) },
    ],
  },

  // ─────────────────── VPCS courses (Tier D) ───────────────────
  'networking-basics/1/2': { // Basic IP & Ping
    settleMs: 4000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.1.1 255.255.255.0'] },
      { node: 'PC2', commands: ['ip 192.168.1.2 255.255.255.0'] },
    ],
  },
  'networking-basics/2/1': { // Multiple Subnets
    settleMs: 4000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.1.1 255.255.255.0'] },
      { node: 'PC2', commands: ['ip 192.168.1.2 255.255.255.0'] },
      { node: 'PC3', commands: ['ip 10.0.0.1 255.255.255.0'] },
      { node: 'PC4', commands: ['ip 10.0.0.2 255.255.255.0'] },
    ],
  },
  'ip-subnetting/0/1': { // /26 subnet
    settleMs: 4000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.10.11 255.255.255.192'] },
      { node: 'PC2', commands: ['ip 192.168.10.22 255.255.255.192'] },
      { node: 'PC3', commands: ['ip 192.168.10.33 255.255.255.192'] },
    ],
  },
  'ip-subnetting/1/1': { // Default Gateway
    settleMs: 4000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.20.10 255.255.255.0 192.168.20.1'] },
      { node: 'PC2', commands: ['ip 192.168.20.20 255.255.255.0 192.168.20.1'] },
    ],
  },
  'ccna-intro/1/1': { // Multi-Switch LAN
    settleMs: 5000,
    groups: [
      { node: 'PC1', commands: ['ip 172.16.0.11 255.255.255.0'] },
      { node: 'PC2', commands: ['ip 172.16.0.22 255.255.255.0'] },
      { node: 'PC3', commands: ['ip 172.16.0.33 255.255.255.0'] },
      { node: 'PC4', commands: ['ip 172.16.0.44 255.255.255.0'] },
    ],
  },
  'ccna-intro/3/1': { // Fix the Broken Host
    settleMs: 5000,
    groups: [
      { node: 'PC1', commands: ['ip 192.168.50.10 255.255.255.0'] },
      { node: 'PC2', commands: ['ip 192.168.50.20 255.255.255.0'] },
      { node: 'PC3', commands: ['ip 192.168.50.30 255.255.255.0'] },
    ],
  },
};

// Risk-ordered groups (matching the runbook tiers).
export const GROUPS = {
  smoke: ['network-troubleshooting/0/1'],
  tierA: [
    'network-troubleshooting/0/6', // #1 IPsec-TS
    'network-security/2/1',        // #2 IPsec
    'network-security/3/1',        // #3 WireGuard
    'network-troubleshooting/1/2', // #4 Boss 3-fault
    'ospf-hands-on/4/3',           // #5 OSPF Boss
    'network-security/1/1',        // #6 Zone firewall
  ],
  tierB: [
    'ccnp-advanced-routing/3/1',   // #7 BGP RR (3×VyOS)
    'ospf-hands-on/1/0',           // #8 OSPF Multi-Area (3×VyOS)
    'ospf-hands-on/2/1',           // #9 OSPF Stub (3×VyOS)
    'ipv6-deep-dive/1/1',          // #10 Static route6 (3×VyOS)
    'ospf-hands-on/4/1',           // #11 OSPF TS area mismatch
    'ospf-hands-on/4/2',           // #12 OSPF TS hello timer
    'network-troubleshooting/0/5', // #13 DHCP relay TS
    'network-troubleshooting/0/3', // #14 NAT TS
    'network-troubleshooting/1/1', // #15 GRE TS
    'network-troubleshooting/1/0', // #16 VLAN TS
    'network-troubleshooting/0/2', // #17 BGP TS
    'network-troubleshooting/0/4', // #18 Mystery
    'network-troubleshooting/0/1', // #19 link disable TS (smoke)
  ],
  tierC: [
    'ccnp-advanced-routing/3/0',   // #20 eBGP
    'ccnp-advanced-routing/3/2',   // #21 BGP Route Map
    'ccnp-advanced-routing/3/4',   // #22 GRE
    'ccnp-advanced-routing/2/2',   // #23 Static NAT
    'ccnp-advanced-routing/2/3',   // #24 Dynamic NAT
    'ccnp-advanced-routing/2/4',   // #25 PAT
    'ccnp-advanced-routing/2/1',   // #26 DHCP Relay
    'ccnp-advanced-routing/2/0',   // #27 DHCP
    'ccnp-advanced-routing/3/3',   // #28 Extended ACL
    'ospf-hands-on/0/1',           // #29 OSPF Single Area
    'ospf-hands-on/3/0',           // #30 OSPF Redistribute
    'ipv6-deep-dive/0/1',          // #31 IPv6 addressing
    'ipv6-deep-dive/2/1',          // #32 OSPFv3
    'network-security/5/1',        // #33 SSH Hardening
    'ip-services/1/1',             // #34 NTP
    'ip-services/0/1',             // #35 DNS Forwarder
    'ip-services/4/1',             // #36 Traffic Shaping
    'ccnp-core/3/0',               // #37 VRRP
    'ccnp-core/3/1',               // #38 HSRP(VRRP)
    'ccnp-core/2/2',               // #39 EtherChannel
    'ccnp-core/2/0',               // #40 VLAN
    'ccnp-core/2/1',               // #41 Inter-VLAN RoaS (needs SW ports)
    'ccnp-core/2/4',               // #42 Port Security
    'ccnp-core/2/3',               // #43 PortFast/STP bridge
    'ccnp-core/2/5',               // #44 Local SPAN
    'ccnp-core/3/2',               // #45 SSH
    'ccnp-core/3/3',               // #46 Syslog
  ],
  tierD: [
    'ccna-intro/3/1',              // #47 Fix the Broken Host
    'ccna-intro/1/1',              // #48 Multi-Switch LAN
    'ip-subnetting/1/1',           // #49 Default Gateway
    'ip-subnetting/0/1',           // #50 /26 subnet
    'networking-basics/1/2',       // #51 Basic IP & Ping
    'networking-basics/2/1',       // #52 Multiple Subnets
  ],
  tierE: [ // sandbox: build/boot/teardown only (no answer key)
    'playground/0/0', 'playground/0/1', 'playground/0/2', 'playground/0/3',
  ],
  // legacy aliases
  troubleshoot: [
    'network-troubleshooting/0/1', 'network-troubleshooting/0/2', 'network-troubleshooting/0/3',
    'network-troubleshooting/0/4', 'network-troubleshooting/0/5', 'network-troubleshooting/1/0',
    'network-troubleshooting/1/1',
    'ospf-hands-on/4/1', 'ospf-hands-on/4/2',
  ],
};
