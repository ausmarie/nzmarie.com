import { NextResponse } from 'next/server';
import { Region } from '@/types/property';

const regionsData: Region[] = [
  {
    id: "auckland",
    name: "Auckland",
    cities: [
      {
        id: "auckland",
        name: "Auckland",
        suburbs: [
          { id: "auckland central", name: "Auckland Central" },
          { id: "albany", name: "Albany" },
          { id: "avondale", name: "Avondale" },
          { id: "bayswater", name: "Bayswater" },
          { id: "beachlands", name: "Beachlands" },
          { id: "belmont", name: "Belmont" },
          { id: "birkenhead", name: "Birkenhead" },
          { id: "blockhouse bay", name: "Blockhouse Bay" },
          { id: "botany downs", name: "Botany Downs" },
          { id: "browns bay", name: "Browns Bay" },
          { id: "bucklands beach", name: "Bucklands Beach" },
          { id: "campbells bay", name: "Campbells Bay" },
          { id: "devonport", name: "Devonport" },
          { id: "east tamaki", name: "East Tamaki" },
          { id: "eden terrace", name: "Eden Terrace" },
          { id: "ellerslie", name: "Ellerslie" },
          { id: "epsom", name: "Epsom" },
          { id: "flat bush", name: "Flat Bush" },
          { id: "glen eden", name: "Glen Eden" },
          { id: "glen innes", name: "Glen Innes" },
          { id: "glendowie", name: "Glendowie" },
          { id: "glenfield", name: "Glenfield" },
          { id: "grafton", name: "Grafton" },
          { id: "greenlane", name: "Greenlane" },
          { id: "grey lynn", name: "Grey Lynn" },
          { id: "half moon bay", name: "Half Moon Bay" },
          { id: "henderson", name: "Henderson" },
          { id: "herne bay", name: "Herne Bay" },
          { id: "highland park", name: "Highland Park" },
          { id: "hillsborough", name: "Hillsborough" },
          { id: "howick", name: "Howick" },
          { id: "kingsland", name: "Kingsland" },
          { id: "kohimarama", name: "Kohimarama" },
          { id: "long bay", name: "Long Bay" },
          { id: "lynfield", name: "Lynfield" },
          { id: "mairangi bay", name: "Mairangi Bay" },
          { id: "mangere", name: "Mangere" },
          { id: "mangere bridge", name: "Mangere Bridge" },
          { id: "manukau", name: "Manukau" },
          { id: "manurewa", name: "Manurewa" },
          { id: "maraetai", name: "Maraetai" },
          { id: "massey", name: "Massey" },
          { id: "meadowbank", name: "Meadowbank" },
          { id: "milford", name: "Milford" },
          { id: "mission bay", name: "Mission Bay" },
          { id: "morningside", name: "Morningside" },
          { id: "mount albert", name: "Mount Albert" },
          { id: "mount eden", name: "Mount Eden" },
          { id: "mount roskill", name: "Mount Roskill" },
          { id: "mount wellington", name: "Mount Wellington" },
          { id: "new lynn", name: "New Lynn" },
          { id: "new windsor", name: "New Windsor" },
          { id: "newmarket", name: "Newmarket" },
          { id: "northcote", name: "Northcote" },
          { id: "one tree hill", name: "One Tree Hill" },
          { id: "onehunga", name: "Onehunga" },
          { id: "orakei", name: "Orakei" },
          { id: "orewa", name: "Orewa" },
          { id: "otahuhu", name: "Otahuhu" },
          { id: "otara", name: "Otara" },
          { id: "pakuranga", name: "Pakuranga" },
          { id: "panmure", name: "Panmure" },
          { id: "papakura", name: "Papakura" },
          { id: "papatoetoe", name: "Papatoetoe" },
          { id: "parnell", name: "Parnell" },
          { id: "penrose", name: "Penrose" },
          { id: "point chevalier", name: "Point Chevalier" },
          { id: "ponsonby", name: "Ponsonby" },
          { id: "pukekohe", name: "Pukekohe" },
          { id: "ranui", name: "Ranui" },
          { id: "remuera", name: "Remuera" },
          { id: "rosedale", name: "Rosedale" },
          { id: "royal oak", name: "Royal Oak" },
          { id: "saint heliers", name: "Saint Heliers" },
          { id: "saint johns", name: "Saint Johns" },
          { id: "sandringham", name: "Sandringham" },
          { id: "silverdale", name: "Silverdale" },
          { id: "takanini", name: "Takanini" },
          { id: "takapuna", name: "Takapuna" },
          { id: "te atatu peninsula", name: "Te Atatu Peninsula" },
          { id: "three kings", name: "Three Kings" },
          { id: "titirangi", name: "Titirangi" },
          { id: "torbay", name: "Torbay" },
          { id: "waiuku", name: "Waiuku" },
          { id: "waterview", name: "Waterview" },
          { id: "western springs", name: "Western Springs" },
          { id: "westmere", name: "Westmere" },
          { id: "whenuapai", name: "Whenuapai" }
        ]
      }
    ]
  },
  {
    id: "wellington",
    name: "Wellington",
    cities: [
      {
        id: "wellington",
        name: "Wellington",
        suburbs: [
          { id: "aro valley", name: "Aro Valley" },
          { id: "berhampore", name: "Berhampore" },
          { id: "brooklyn", name: "Brooklyn" },
          { id: "hataitai", name: "Hataitai" },
          { id: "johnsonville", name: "Johnsonville" },
          { id: "karori", name: "Karori" },
          { id: "kelburn", name: "Kelburn" },
          { id: "khandallah", name: "Khandallah" },
          { id: "kilbirnie", name: "Kilbirnie" },
          { id: "lyall bay", name: "Lyall Bay" },
          { id: "miramar", name: "Miramar" },
          { id: "mount cook", name: "Mount Cook" },
          { id: "mount victoria", name: "Mount Victoria" },
          { id: "newtown", name: "Newtown" },
          { id: "oriental bay", name: "Oriental Bay" },
          { id: "thorndon", name: "Thorndon" },
          { id: "wellington central", name: "Wellington Central" }
        ]
      },
      {
        id: "lower-hutt",
        name: "Lower Hutt",
        suburbs: [
          { id: "alicetown", name: "Alicetown" },
          { id: "avalon", name: "Avalon" },
          { id: "eastbourne", name: "Eastbourne" },
          { id: "epuni", name: "Epuni" },
          { id: "hutt central", name: "Hutt Central" },
          { id: "naenae", name: "Naenae" },
          { id: "petone", name: "Petone" },
          { id: "stokes valley", name: "Stokes Valley" },
          { id: "wainuiomata", name: "Wainuiomata" }
        ]
      },
      {
        id: "upper-hutt",
        name: "Upper Hutt",
        suburbs: [
          { id: "heretaunga", name: "Heretaunga" },
          { id: "silverstream", name: "Silverstream" },
          { id: "trentham", name: "Trentham" },
          { id: "upper hutt central", name: "Upper Hutt Central" }
        ]
      },
      {
        id: "porirua",
        name: "Porirua",
        suburbs: [
          { id: "aotea", name: "Aotea" },
          { id: "elsdon", name: "Elsdon" },
          { id: "plimmerton", name: "Plimmerton" },
          { id: "porirua city centre", name: "Porirua City Centre" },
          { id: "titahi bay", name: "Titahi Bay" },
          { id: "whitby", name: "Whitby" }
        ]
      }
    ]
  }
];

export async function GET() {
  try {
    return NextResponse.json(regionsData);
  } catch (error) {
    console.error('Failed to fetch regions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch regions' }, 
      { status: 500 }
    );
  }
}
