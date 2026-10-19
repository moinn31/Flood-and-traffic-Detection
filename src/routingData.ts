/* ============================================
   VADODARA SMART CITY — ROUTE & DETOUR ADVISORY ENGINE
   Geospatial paths, hazard corridors & safe alternative routes
   ============================================ */

export interface AlternativeDetour {
  id: string;
  name: string;
  via: string;
  distanceDelta: string;
  timeEstimate: string;
  elevation: string;
  status: 'recommended' | 'alternative' | 'emergency-only';
  instructions: string[];
  coordinates: [number, number][];
}

export interface AreaRouteProfile {
  areaName: string;
  center: [number, number];
  primaryVulnerability: string;
  blockedCorridor: {
    name: string;
    description: string;
    coordinates: [number, number][];
  };
  detours: AlternativeDetour[];
}

export const VADODARA_ROUTE_PROFILES: Record<string, AreaRouteProfile> = {
  'Alkapuri': {
    areaName: 'Alkapuri',
    center: [22.3110, 73.1725],
    primaryVulnerability: 'Alkapuri Railway Underpass flooding (>180cm) & RC Dutt Road peak gridlock',
    blockedCorridor: {
      name: 'Alkapuri Railway Underpass & RC Dutt Road',
      description: 'Underpass submerged; road inundated with low drainage egress.',
      coordinates: [
        [22.3110, 73.1725],
        [22.3125, 73.1750],
        [22.3140, 73.1780],
        [22.3150, 73.1810],
      ],
    },
    detours: [
      {
        id: 'alk-detour-1',
        name: 'Primary Bypass (Flyover Corridor)',
        via: 'Race Course Circle → Chakli Circle → Akota Dandia Bazar Flyover',
        distanceDelta: '+1.6 km',
        timeEstimate: '7 mins',
        elevation: '+14m Elevated Flyover (Zero Flood Risk)',
        status: 'recommended',
        instructions: [
          'Divert south at Bird Circle towards Race Course Road',
          'Follow the elevated 6-lane Akota Flyover across Vishwamitri basin',
          'Exit onto Dandia Bazar / Palace Road with unrestricted traffic flow',
        ],
        coordinates: [
          [22.3110, 73.1680],
          [22.3060, 73.1665],
          [22.3000, 73.1680],
          [22.2965, 73.1740],
          [22.2980, 73.1830],
        ],
      },
      {
        id: 'alk-detour-2',
        name: 'Northern Ring Bypass',
        via: 'Subhanpura Main Road → Alembic Road → Gorwa Ring Road',
        distanceDelta: '+2.8 km',
        timeEstimate: '10 mins',
        elevation: '+11m High-Plinth Corridor',
        status: 'alternative',
        instructions: [
          'Turn northwest towards Subhanpura High Street',
          'Proceed along Alembic Industrial Road past Gorwa',
          'Rejoin western highway via Gotri-Gorwa link',
        ],
        coordinates: [
          [22.3110, 73.1725],
          [22.3160, 73.1670],
          [22.3220, 73.1620],
          [22.3270, 73.1610],
          [22.3300, 73.1700],
        ],
      },
    ],
  },

  'Akota': {
    areaName: 'Akota',
    center: [22.2950, 73.1680],
    primaryVulnerability: 'Akota Stadium Road waterlogging & Mujmahuda choke point',
    blockedCorridor: {
      name: 'Akota Stadium Arterial Road',
      description: 'Stormwater overflow from adjacent storm channel causing traffic halt.',
      coordinates: [
        [22.2950, 73.1680],
        [22.2970, 73.1710],
        [22.2990, 73.1750],
      ],
    },
    detours: [
      {
        id: 'ako-detour-1',
        name: 'Old Padra Bypass',
        via: 'Old Padra Road → Bird Circle → Race Course',
        distanceDelta: '+1.2 km',
        timeEstimate: '6 mins',
        elevation: '+10m High Ground',
        status: 'recommended',
        instructions: [
          'Turn west onto Old Padra 4-lane arterial',
          'Continue past Bird Circle towards central sectors',
          'Clear storm drains, normal road speeds',
        ],
        coordinates: [
          [22.2950, 73.1680],
          [22.2970, 73.1620],
          [22.3020, 73.1640],
          [22.3080, 73.1670],
        ],
      },
      {
        id: 'ako-detour-2',
        name: 'Mujmahuda - Dandia Link',
        via: 'Mujmahuda Char Rasta → Rajmahal Road',
        distanceDelta: '+2.1 km',
        timeEstimate: '9 mins',
        elevation: '+8m Operational Drain',
        status: 'alternative',
        instructions: [
          'Take southern connector towards Mujmahuda',
          'Cross via historic Palace bypass to east city',
        ],
        coordinates: [
          [22.2950, 73.1680],
          [22.2900, 73.1700],
          [22.2930, 73.1800],
        ],
      },
    ],
  },

  'Manjalpur': {
    areaName: 'Manjalpur',
    center: [22.2760, 73.1930],
    primaryVulnerability: 'GIDC Industrial storm runoff & Shreyas Crossing congestion',
    blockedCorridor: {
      name: 'Manjalpur Main GIDC Arterial',
      description: 'Industrial drainage backflow & bottleneck near railroad crossing.',
      coordinates: [
        [22.2760, 73.1930],
        [22.2800, 73.1950],
        [22.2850, 73.1970],
      ],
    },
    detours: [
      {
        id: 'man-detour-1',
        name: 'Makarpura Highway Bypass',
        via: 'Makarpura Road → Tarsali Bypass → NH-48 Ring',
        distanceDelta: '+2.3 km',
        timeEstimate: '8 mins',
        elevation: '+15m Highway Grade',
        status: 'recommended',
        instructions: [
          'Divert south towards Makarpura Air Force Station road',
          'Take the 6-lane bypass directly around industrial sector',
          'Wide storm culverts keep this route 100% dry',
        ],
        coordinates: [
          [22.2760, 73.1930],
          [22.2700, 73.1900],
          [22.2680, 73.2050],
          [22.2780, 73.2100],
        ],
      },
    ],
  },

  'Karelibaug': {
    areaName: 'Karelibaug',
    center: [22.3230, 73.2000],
    primaryVulnerability: 'Amrapali Char Rasta low-basin inundation & Vishwamitri surge',
    blockedCorridor: {
      name: 'Karelibaug Water Tank Road & Amrapali Crossroad',
      description: 'Vishwamitri tributary overflow crossing carriageway.',
      coordinates: [
        [22.3230, 73.2000],
        [22.3260, 73.1980],
        [22.3290, 73.1960],
      ],
    },
    detours: [
      {
        id: 'kar-detour-1',
        name: 'VIP Airport Express Way',
        via: 'VIP Road → Amit Nagar Circle → Harni Flyover',
        distanceDelta: '+1.9 km',
        timeEstimate: '7 mins',
        elevation: '+16m Elevated Ring',
        status: 'recommended',
        instructions: [
          'Divert north onto VIP Road toward Amit Nagar',
          'Follow the newly elevated storm drainage flyover',
          'Clear high-speed dual carriageway',
        ],
        coordinates: [
          [22.3230, 73.2000],
          [22.3280, 73.2060],
          [22.3350, 73.2080],
          [22.3380, 73.2010],
        ],
      },
    ],
  },

  'Waghodia Road': {
    areaName: 'Waghodia Road',
    center: [22.3100, 73.2200],
    primaryVulnerability: 'National Highway underpass overflow & Parivar Char Rasta jam',
    blockedCorridor: {
      name: 'Waghodia Crossing Highway Underpass',
      description: 'Heavy water pooling below highway underbridge.',
      coordinates: [
        [22.3100, 73.2200],
        [22.3120, 73.2250],
        [22.3140, 73.2300],
      ],
    },
    detours: [
      {
        id: 'wag-detour-1',
        name: 'Ajwa Road Parallel Link',
        via: 'Ajwa Road → Kamlanagar Lake Perimeter → Ring Road',
        distanceDelta: '+2.5 km',
        timeEstimate: '9 mins',
        elevation: '+13m Elevated Bund Road',
        status: 'recommended',
        instructions: [
          'Turn north onto Ajwa Road at Sayaji Township link',
          'Follow the elevated bund road bypassing flooded low-lying culvert',
        ],
        coordinates: [
          [22.3100, 73.2200],
          [22.3180, 73.2220],
          [22.3240, 73.2280],
        ],
      },
    ],
  },

  'Fatehgunj': {
    areaName: 'Fatehgunj',
    center: [22.3200, 73.1850],
    primaryVulnerability: 'University Campus main road surge & Camp Road bottleneck',
    blockedCorridor: {
      name: 'Fatehgunj Main Market & Camp Road',
      description: 'Surface runoff bottleneck with stalled vehicular flow.',
      coordinates: [
        [22.3200, 73.1850],
        [22.3220, 73.1830],
        [22.3250, 73.1810],
      ],
    },
    detours: [
      {
        id: 'fat-detour-1',
        name: 'Narhari Hospital Perimeter Link',
        via: 'Pratapgunj Road → Sayaji Baug North Gate → Kala Ghoda',
        distanceDelta: '+1.4 km',
        timeEstimate: '6 mins',
        elevation: '+11m High Bank Corridor',
        status: 'recommended',
        instructions: [
          'Divert southeast through Pratapgunj academic perimeter',
          'Reach Kala Ghoda with open dual-lane traffic',
        ],
        coordinates: [
          [22.3200, 73.1850],
          [22.3170, 73.1880],
          [22.3150, 73.1910],
        ],
      },
    ],
  },

  'Sayajigunj': {
    areaName: 'Sayajigunj',
    center: [22.3150, 73.1900],
    primaryVulnerability: 'Railway Station Forecourt flooding & Kala Ghoda intersection jam',
    blockedCorridor: {
      name: 'Station Road & Sayajigunj Circle',
      description: 'Transit hub congestion compounded by station drain surcharge.',
      coordinates: [
        [22.3150, 73.1900],
        [22.3130, 73.1880],
        [22.3100, 73.1850],
      ],
    },
    detours: [
      {
        id: 'say-detour-1',
        name: 'Sayaji Baug Park Perimeter',
        via: 'Dairy Den Circle → Vinoba Bhave Road → Alkapuri East',
        distanceDelta: '+1.3 km',
        timeEstimate: '5 mins',
        elevation: '+12m Elevated Promenade',
        status: 'recommended',
        instructions: [
          'Take park perimeter road around Sayaji Baug gardens',
          'Completely bypass train station traffic jam',
        ],
        coordinates: [
          [22.3150, 73.1900],
          [22.3180, 73.1920],
          [22.3210, 73.1860],
        ],
      },
    ],
  },

  'Gorwa': {
    areaName: 'Gorwa',
    center: [22.3300, 73.1600],
    primaryVulnerability: 'Industrial drainage block near Alembic Glass works',
    blockedCorridor: {
      name: 'Gorwa BIDC Main Road',
      description: 'Heavy truck gridlock with localized canal backpressure.',
      coordinates: [
        [22.3300, 73.1600],
        [22.3330, 73.1580],
        [22.3370, 73.1550],
      ],
    },
    detours: [
      {
        id: 'gor-detour-1',
        name: 'Panchvati Link Road',
        via: 'Panchvati Circle → Subhanpura Main Road → Alembic Road',
        distanceDelta: '+2.0 km',
        timeEstimate: '8 mins',
        elevation: '+13m Clear Highway',
        status: 'recommended',
        instructions: [
          'Turn south via Panchvati residential grid',
          'Re-enter main arterial past Alembic overbridge',
        ],
        coordinates: [
          [22.3300, 73.1600],
          [22.3250, 73.1620],
          [22.3200, 73.1640],
        ],
      },
    ],
  },

  'Harni': {
    areaName: 'Harni',
    center: [22.3400, 73.2100],
    primaryVulnerability: 'Harni Lake spillway surcharge & Airport Road water flow',
    blockedCorridor: {
      name: 'Harni Lake Bund Road & Airport Access',
      description: 'Lake spillway overflow across vehicular path.',
      coordinates: [
        [22.3400, 73.2100],
        [22.3430, 73.2130],
        [22.3470, 73.2170],
      ],
    },
    detours: [
      {
        id: 'har-detour-1',
        name: 'Sama-Savli Link Corridor',
        via: 'Sama-Savli Road → New VIP Ring Road → Amit Nagar',
        distanceDelta: '+3.1 km',
        timeEstimate: '9 mins',
        elevation: '+17m High Northern Embankment',
        status: 'recommended',
        instructions: [
          'Divert west onto Sama-Savli elevated 4-lane link',
          'Safe airport transit route approved by VMC emergency command',
        ],
        coordinates: [
          [22.3400, 73.2100],
          [22.3380, 73.2030],
          [22.3340, 73.1950],
        ],
      },
    ],
  },

  'Gotri': {
    areaName: 'Gotri',
    center: [22.3050, 73.1450],
    primaryVulnerability: 'Gotri Canal culvert overflow & Sevasi junction delay',
    blockedCorridor: {
      name: 'Gotri Canal Service Road',
      description: 'Narmada branch canal overflow at low culvert section.',
      coordinates: [
        [22.3050, 73.1450],
        [22.3070, 73.1420],
        [22.3100, 73.1380],
      ],
    },
    detours: [
      {
        id: 'got-detour-1',
        name: 'Vasna-Bhayli 30m Canal Ring',
        via: 'Vasna-Bhayli 30m TP Road → Sun Pharma Road → Akshar Chowk',
        distanceDelta: '+2.4 km',
        timeEstimate: '8 mins',
        elevation: '+14m Modern Storm Drainage Grid',
        status: 'recommended',
        instructions: [
          'Turn south towards newly widened 30m Bhayli TP road',
          'Excellent subterranean stormwater drainage capacity',
        ],
        coordinates: [
          [22.3050, 73.1450],
          [22.2980, 73.1480],
          [22.2950, 73.1550],
        ],
      },
    ],
  },

  'Subhanpura': {
    areaName: 'Subhanpura',
    center: [22.3200, 73.1600],
    primaryVulnerability: 'High Street commercial choke & Ellora Park intersection water pooling',
    blockedCorridor: {
      name: 'Subhanpura High Street & Ellora Park Intersection',
      description: 'Commercial area water ponding and intense shopping traffic halt.',
      coordinates: [
        [22.3200, 73.1600],
        [22.3180, 73.1630],
        [22.3150, 73.1660],
      ],
    },
    detours: [
      {
        id: 'sub-detour-1',
        name: 'Samta - Laxmipura Ring Link',
        via: 'Samta Road → Laxmipura Ring Road → Gotri Road',
        distanceDelta: '+1.9 km',
        timeEstimate: '7 mins',
        elevation: '+12m Residential Grid Flow',
        status: 'recommended',
        instructions: [
          'Divert west towards Samta 4-lane avenue',
          'Follow western ring to bypass shopping district completely',
        ],
        coordinates: [
          [22.3200, 73.1600],
          [22.3230, 73.1540],
          [22.3150, 73.1500],
        ],
      },
    ],
  },
};

/**
 * Returns active routing advice for an area based on live water level and traffic density.
 */
export function getRouteAdviceForArea(
  areaName: string,
  waterLevel: number,
  trafficPercentage: number
): {
  isHazard: boolean;
  hazardType: 'flood' | 'traffic' | 'both' | 'normal';
  profile: AreaRouteProfile;
  activeAlertMessage: string;
} {
  const profile = VADODARA_ROUTE_PROFILES[areaName] || VADODARA_ROUTE_PROFILES['Alkapuri'];
  const isFlood = waterLevel >= 180;
  const isFloodWarn = waterLevel >= 100 && !isFlood;
  const isTraffic = trafficPercentage >= 75;
  const isTrafficWarn = trafficPercentage >= 50 && !isTraffic;

  let isHazard = isFlood || isTraffic;
  let hazardType: 'flood' | 'traffic' | 'both' | 'normal' = 'normal';
  let activeAlertMessage = 'Roads operational. Nominal vehicular and hydrodynamic telemetry.';

  if (isFlood && isTraffic) {
    hazardType = 'both';
    activeAlertMessage = `CRITICAL HAZARD: Hydrodynamic surge (${waterLevel.toFixed(1)}cm) & Severe gridlock (${trafficPercentage}%). Avoid ${profile.blockedCorridor.name}!`;
  } else if (isFlood) {
    hazardType = 'flood';
    activeAlertMessage = `FLOOD SURGE: Inundation (${waterLevel.toFixed(1)}cm >= 180cm danger threshold). ${profile.blockedCorridor.name} is SUBMERGED.`;
  } else if (isTraffic) {
    hazardType = 'traffic';
    activeAlertMessage = `TRAFFIC CONGESTION: ${profile.blockedCorridor.name} operating at ${trafficPercentage}% road capacity. Gridlock detected.`;
  } else if (isFloodWarn || isTrafficWarn) {
    activeAlertMessage = `ADVISORY: Moderate conditions (${waterLevel.toFixed(1)}cm water, ${trafficPercentage}% traffic). Slow speeds expected.`;
  }

  return {
    isHazard,
    hazardType,
    profile,
    activeAlertMessage,
  };
}
