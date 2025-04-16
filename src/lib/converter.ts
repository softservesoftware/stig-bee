/* eslint-disable @typescript-eslint/no-explicit-any */

import { XMLParser } from "fast-xml-parser";
import { v4 as uuidv4 } from "uuid";

// Define types for CKL data
export interface CklData {
  CHECKLIST: {
    ASSET: {
      ROLE: string;
      ASSET_TYPE: string;
      HOST_NAME: string;
      HOST_IP: string;
      HOST_MAC: string;
      HOST_FQDN: string;
      TARGET_COMMENT: string;
      TECH_AREA: string;
      TARGET_KEY: string;
      WEB_OR_DATABASE: string;
      WEB_DB_SITE: string;
      WEB_DB_INSTANCE: string;
    };
    STIGS: {
      iSTIG: {
        STIG_INFO: {
          TITLE: string;
          VERSION: string;
          RELEASE_INFO: string;
          SOURCE: string;
          STIG_ID?: string;
          DESCRIPTION?: string;
          UUID?: string;
          NOTICE?: string;
        };
        VULN: Array<{
          STIG_DATA: Array<{
            VULN_ATTRIBUTE: string;
            ATTRIBUTE_DATA: string;
          }>;
          STATUS: string;
          SEVERITY?: string;
          FINDING_DETAILS?: string;
          COMMENTS?: string;
          SEVERITY_OVERRIDE?: string;
          SEVERITY_JUSTIFICATION?: string;
        }>;
      };
    };
  };
}

// Define types for XML data
export interface ParsedXml {
  Benchmark: {
    "@_xmlns:xccdf"?: string;
    "@_xmlns:xhtml"?: string;
    "@_xmlns:dc"?: string;
    "@_xmlns:xsi"?: string;
    "@_xsi:schemaLocation"?: string;
    "@_id"?: string;
    title: string;
    description: string;
    "plain-text": { "#text": string };
    status: { "#text": string; "@_date": string };
    reference: { "#text": string; "@_href": string };
    Group: Array<{
      title: string;
      description: string;
      "@_id": string;
      status?: string;
      findingDetails?: string;
      comments?: string;
      Rule: {
        version: string;
        title: string;
        description: string | { VulnDiscussion?: string; "#text"?: string };
        check: {
          "check-content": string;
        };
        fixtext: {
          "#text": string;
        };
        "@_id": string;
        "@_severity": string;
      };
    }>;
  };
}

/**
 * Convert XML data to CKL format
 * @param xmlData The parsed XML data
 * @returns CKL data
 */
export function convertXmlToCkl(xmlData: ParsedXml): CklData {
  // Create a new CKL object
  const cklData: CklData = {
    CHECKLIST: {
      ASSET: {
        ROLE: "None",
        ASSET_TYPE: "Computing",
        HOST_NAME: "localhost",
        HOST_IP: "127.0.0.1",
        HOST_MAC: "00:00:00:00:00:00",
        HOST_FQDN: "localhost.localdomain",
        TARGET_COMMENT: "",
        TECH_AREA: "",
        TARGET_KEY: "",
        WEB_OR_DATABASE: "false",
        WEB_DB_SITE: "",
        WEB_DB_INSTANCE: ""
      },
      STIGS: {
        iSTIG: {
          STIG_INFO: {
            TITLE: xmlData.Benchmark.title,
            VERSION: xmlData.Benchmark["plain-text"]["#text"],
            RELEASE_INFO: xmlData.Benchmark.status["#text"],
            SOURCE: xmlData.Benchmark.reference["#text"],
            STIG_ID: xmlData.Benchmark["@_id"] || "unknown",
            DESCRIPTION: xmlData.Benchmark.description,
            UUID: uuidv4()
          },
          VULN: []
        }
      }
    }
  };

  // Process each group in the XML data
  xmlData.Benchmark.Group.forEach(group => {
    // Extract vulnerability data from the group
    const vulnData: Record<string, string> = {
      Vuln_Num: group["@_id"],
      Severity: group.Rule["@_severity"],
      Group_Title: group.title,
      Rule_ID: group.Rule["@_id"],
      Rule_Ver: group.Rule.version,
      Rule_Title: group.Rule.title,
      Vuln_Discuss: typeof group.Rule.description === 'string' 
        ? group.Rule.description 
        : (group.Rule.description as any).VulnDiscussion || "",
      Check_Content: group.Rule.check["check-content"],
      Fix_Text: group.Rule.fixtext["#text"]
    };

    // Convert to STIG_DATA format
    const stigData = Object.entries(vulnData).map(([key, value]) => ({
      VULN_ATTRIBUTE: key,
      ATTRIBUTE_DATA: value || ""
    }));

    // Add the vulnerability to the CKL data
    cklData.CHECKLIST.STIGS.iSTIG.VULN.push({
      STIG_DATA: stigData,
      STATUS: group.status || "Not_Reviewed",
      SEVERITY: group.Rule["@_severity"],
      FINDING_DETAILS: group.findingDetails || "",
      COMMENTS: group.comments || ""
    });
  });

  return cklData;
}

/**
 * Convert CKL data to XML string
 * @param cklData The CKL data
 * @returns XML string
 */
export function convertCklToXmlString(cklData: CklData): string {
  let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xmlString += '<!--DISA STIG Viewer :: 2.11-->\n';
  xmlString += '<CHECKLIST>\n';
  
  // Add ASSET section
  xmlString += '  <ASSET>\n';
  for (const [key, value] of Object.entries(cklData.CHECKLIST.ASSET)) {
    xmlString += `    <${key}>${value}</${key}>\n`;
  }
  xmlString += '  </ASSET>\n';
  
  // Add STIGS section
  xmlString += '  <STIGS>\n';
  xmlString += '    <iSTIG>\n';
  
  // Add STIG_INFO section
  xmlString += '      <STIG_INFO>\n';
  for (const [key, value] of Object.entries(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO)) {
    if (value) {
      xmlString += `        <SI_DATA>\n`;
      xmlString += `          <SID_NAME>${key}</SID_NAME>\n`;
      xmlString += `          <SID_DATA>${value}</SID_DATA>\n`;
      xmlString += `        </SI_DATA>\n`;
    }
  }
  xmlString += '      </STIG_INFO>\n';
  
  // Add VULN sections
  for (const vuln of cklData.CHECKLIST.STIGS.iSTIG.VULN) {
    xmlString += '      <VULN>\n';
    
    // Add STIG_DATA sections
    for (const stigData of vuln.STIG_DATA) {
      xmlString += '        <STIG_DATA>\n';
      xmlString += `          <VULN_ATTRIBUTE>${stigData.VULN_ATTRIBUTE}</VULN_ATTRIBUTE>\n`;
      xmlString += `          <ATTRIBUTE_DATA>${stigData.ATTRIBUTE_DATA}</ATTRIBUTE_DATA>\n`;
      xmlString += '        </STIG_DATA>\n';
    }
    
    // Add STATUS, SEVERITY, FINDING_DETAILS, and COMMENTS
    if (vuln.STATUS) {
      xmlString += `        <STATUS>${vuln.STATUS}</STATUS>\n`;
    }
    if (vuln.SEVERITY) {
      xmlString += `        <SEVERITY>${vuln.SEVERITY}</SEVERITY>\n`;
    }
    if (vuln.FINDING_DETAILS) {
      xmlString += `        <FINDING_DETAILS>${vuln.FINDING_DETAILS}</FINDING_DETAILS>\n`;
    }
    if (vuln.COMMENTS) {
      xmlString += `        <COMMENTS>${vuln.COMMENTS}</COMMENTS>\n`;
    }
    if (vuln.SEVERITY_OVERRIDE) {
      xmlString += `        <SEVERITY_OVERRIDE>${vuln.SEVERITY_OVERRIDE}</SEVERITY_OVERRIDE>\n`;
    }
    if (vuln.SEVERITY_JUSTIFICATION) {
      xmlString += `        <SEVERITY_JUSTIFICATION>${vuln.SEVERITY_JUSTIFICATION}</SEVERITY_JUSTIFICATION>\n`;
    }
    
    xmlString += '      </VULN>\n';
  }
  
  xmlString += '    </iSTIG>\n';
  xmlString += '  </STIGS>\n';
  xmlString += '</CHECKLIST>';
  
  return xmlString;
}

/**
 * Parse XML string to CKL data
 * @param xmlString The XML string
 * @returns CKL data
 */
export function parseXmlToCkl(xmlString: string): CklData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  
  return parser.parse(xmlString);
}

/**
 * Parse CKL string to CKL data
 * @param cklString The CKL string
 * @returns CKL data
 */
export function parseCklString(cklString: string): CklData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  
  return parser.parse(cklString);
} 