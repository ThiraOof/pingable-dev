// Shared helpers for the VyOS-based hands-on labs.
//
// We cannot ship a licensed Cisco IOS image, so the configuration labs run on
// the open-source **VyOS Universal Router** appliance from the GNS3 marketplace
// (https://gns3.com/marketplace/appliances/vyos-universal-router). VyOS is a
// single free image whose VyOS/Junos-style `set`/`show` CLI covers BGP, NAT,
// GRE, VRRP, DHCP, DHCP-relay, firewall (ACL), 802.1Q VLAN, LACP bonding
// (EtherChannel) and port-mirroring (SPAN).
//
// The template UUID is server-specific. Register the VyOS appliance on your
// GNS3 server, then set GNS3_VYOS_TEMPLATE in .env to its template_id.
// (load-env.js must be imported before this module so the value is available.)

export const VYOS_TEMPLATE =
  process.env.GNS3_VYOS_TEMPLATE || '<SET_GNS3_VYOS_TEMPLATE_IN_ENV>';

// VyOS router node. NICs map ethN → GNS3 adapter N (see gns3Service.buildLab),
// so a link `port` value equals the VyOS interface number (port 1 → eth1).
export const vyos = (name, x = 0, y = 0) => ({
  name,
  nodeType: 'qemu',
  templateId: VYOS_TEMPLATE,
  x,
  y,
});

// Virtual PC (built-in VPCS) — used as hosts/clients in the labs.
export const pc = (name, x = 0, y = 0) => ({ name, nodeType: 'vpcs', x, y });

// Built-in Ethernet switch — supports access/802.1Q ports for VLAN labs.
export const sw = (name, x = 0, y = 0) => ({ name, nodeType: 'ethernet_switch', x, y });
