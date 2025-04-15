import { XMLParser } from "fast-xml-parser";

// Interfaces for XML format
interface Ident {
  "#text": string;
  "@_system": string;
}

interface Rule {
  version: string;
  title: string;
  description: string | { VulnDiscussion?: string; "#text"?: string };
  reference: string;
  ident: Ident | Ident[];
  fixtext: { "#text": string; "@_fixref": string };
  fix: { "@_id": string };
  check: { 
    "check-content-ref": { "@_href": string; "@_name": string }; 
    "check-content": string; 
    "@_system": string 
  };
  "@_id": string;
  "@_weight": number;
  "@_severity": string;
}

interface Group {
  title: string;
  description: string;
  "@_id": string;
  status?: string;
  findingDetails?: string;
  comments?: string;
  Rule: Rule;
}

interface Benchmark {
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
  Group: Group[];
}

interface ParsedXml {
  Benchmark: Benchmark;
}

// Interfaces for CKL format
interface StigData {
  VULN_ATTRIBUTE: string;
  ATTRIBUTE_DATA: string;
}

interface Vulnerability {
  "@_status": string;
  STIG_DATA: StigData[];
  STATUS: string;
  FINDING_DETAILS: string;
  COMMENTS: string;
  SEVERITY: string;
  SEVERITY_OVERRIDE: string;
  SEVERITY_JUSTIFICATION: string;
}

interface StigInfo {
  VERSION: string;
  CLASSIFICATION: string;
  STIG_ID: string;
  TITLE: string;
  DESCRIPTION: string;
  FILENAME: string;
  RELEASE_INFO: string;
  SEVERITY: string;
  STIG_UUID: string;
  NOTICE: string;
  SOURCE: string;
  STIG_VIEWER_VERSION: string;
}

interface Asset {
  ROLE: string;
  ASSET_TYPE: string;
  HOST_NAME: string;
  HOST_IP: string;
  HOST_MAC: string;
  HOST_FQDN: string;
  TECH_AREA: string;
  TARGET_KEY: string;
  WEB_OR_DATABASE: string;
  WEB_DB_SITE: string;
  WEB_DB_INSTANCE: string;
  TARGET_COMMENT: string;
}

export interface CklData {
  CHECKLIST: {
    "@_xmlns:xsi": string;
    "@_xmlns:dsig": string;
    "@_xmlns": string;
    "@_xsi:schemaLocation": string;
    ASSET: Asset;
    STIGS: {
      iSTIG: {
        "@_version": string;
        STIG_INFO: StigInfo;
        VULN: Vulnerability[];
      };
    };
  };
}

/**
 * Converts XML data to CKL format
 * @param xmlData - The XML data to convert
 * @returns The converted CKL data
 */
export function convertXmlToCkl(xmlData: ParsedXml): CklData {
  const benchmark = xmlData.Benchmark;

  const cklData: CklData = {
    CHECKLIST: {
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@_xmlns:dsig": "http://www.w3.org/2000/09/xmldsig#",
      "@_xmlns": "http://checklists.nist.gov/xccdf/1.1",
      "@_xsi:schemaLocation": "http://checklists.nist.gov/xccdf/1.1 xccdf_checklist.1.1.xsd",
      ASSET: {
        ROLE: "None",
        ASSET_TYPE: "Computing",
        HOST_NAME: "",
        HOST_IP: "",
        HOST_MAC: "",
        HOST_FQDN: "",
        TECH_AREA: "",
        TARGET_KEY: "",
        WEB_OR_DATABASE: "false",
        WEB_DB_SITE: "",
        WEB_DB_INSTANCE: "",
        TARGET_COMMENT: benchmark.description || "",
      },
      STIGS: {
        iSTIG: {
          "@_version": "1.0",
          STIG_INFO: {
            VERSION: benchmark["plain-text"]["#text"] || "",
            CLASSIFICATION: "UNCLASSIFIED",
            STIG_ID: benchmark["@_id"] || "",
            TITLE: benchmark.title || "",
            DESCRIPTION: "",
            FILENAME: "",
            RELEASE_INFO: benchmark.status["#text"] || "",
            SEVERITY: "medium",
            STIG_UUID: "",
            NOTICE: "",
            SOURCE: benchmark.reference["#text"] || "",
            STIG_VIEWER_VERSION: "1.0",
          },
          VULN: benchmark.Group.map((group) => {
            const status = group.status || "default";
            const findingDetails = group.findingDetails || "";
            const comments = group.comments || "";
            
            // Extract description text properly
            let descriptionText = "";
            if (typeof group.Rule.description === 'string') {
              descriptionText = group.Rule.description;
            } else if (group.Rule.description && typeof group.Rule.description === 'object') {
              // Handle case where description might be an object with VulnDiscussion
              descriptionText = group.Rule.description.VulnDiscussion || 
                               (group.Rule.description["#text"] || "");
            }

            return {
              "@_status": status,
              STIG_DATA: [
                {
                  VULN_ATTRIBUTE: "Vuln_Num",
                  ATTRIBUTE_DATA: group["@_id"],
                },
                {
                  VULN_ATTRIBUTE: "Group_Title",
                  ATTRIBUTE_DATA: group.title,
                },
                {
                  VULN_ATTRIBUTE: "Rule_ID",
                  ATTRIBUTE_DATA: group.Rule["@_id"],
                },
                {
                  VULN_ATTRIBUTE: "Rule_Ver",
                  ATTRIBUTE_DATA: group.Rule.version,
                },
                {
                  VULN_ATTRIBUTE: "Rule_Title",
                  ATTRIBUTE_DATA: group.Rule.title,
                },
                {
                  VULN_ATTRIBUTE: "Vuln_Discuss",
                  ATTRIBUTE_DATA: descriptionText,
                },
                {
                  VULN_ATTRIBUTE: "Check_Content",
                  ATTRIBUTE_DATA: group.Rule.check["check-content"],
                },
                {
                  VULN_ATTRIBUTE: "Fix_Text",
                  ATTRIBUTE_DATA: group.Rule.fixtext["#text"],
                },
              ],
              STATUS: status,
              FINDING_DETAILS: findingDetails,
              COMMENTS: comments,
              SEVERITY: group.Rule["@_severity"],
              SEVERITY_OVERRIDE: "",
              SEVERITY_JUSTIFICATION: "",
            };
          }),
        },
      },
    },
  };

  return cklData;
}

/**
 * Converts CKL data to XML string format
 * @param cklData - The CKL data to convert
 * @returns The XML string representation of the CKL data
 */
export function convertCklToXmlString(cklData: CklData): string {
  // Escape special characters in attribute values
  const escapeXml = (str: string) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<CHECKLIST xmlns:xsi="${escapeXml(cklData.CHECKLIST["@_xmlns:xsi"])}" xmlns:dsig="${escapeXml(cklData.CHECKLIST["@_xmlns:dsig"])}" xmlns="${escapeXml(cklData.CHECKLIST["@_xmlns"])}" xsi:schemaLocation="${escapeXml(cklData.CHECKLIST["@_xsi:schemaLocation"])}">
  <ASSET>
    <ROLE>${escapeXml(cklData.CHECKLIST.ASSET.ROLE)}</ROLE>
    <ASSET_TYPE>${escapeXml(cklData.CHECKLIST.ASSET.ASSET_TYPE)}</ASSET_TYPE>
    <HOST_NAME>${escapeXml(cklData.CHECKLIST.ASSET.HOST_NAME)}</HOST_NAME>
    <HOST_IP>${escapeXml(cklData.CHECKLIST.ASSET.HOST_IP)}</HOST_IP>
    <HOST_MAC>${escapeXml(cklData.CHECKLIST.ASSET.HOST_MAC)}</HOST_MAC>
    <HOST_FQDN>${escapeXml(cklData.CHECKLIST.ASSET.HOST_FQDN)}</HOST_FQDN>
    <TECH_AREA>${escapeXml(cklData.CHECKLIST.ASSET.TECH_AREA)}</TECH_AREA>
    <TARGET_KEY>${escapeXml(cklData.CHECKLIST.ASSET.TARGET_KEY)}</TARGET_KEY>
    <WEB_OR_DATABASE>${escapeXml(cklData.CHECKLIST.ASSET.WEB_OR_DATABASE)}</WEB_OR_DATABASE>
    <WEB_DB_SITE>${escapeXml(cklData.CHECKLIST.ASSET.WEB_DB_SITE)}</WEB_DB_SITE>
    <WEB_DB_INSTANCE>${escapeXml(cklData.CHECKLIST.ASSET.WEB_DB_INSTANCE)}</WEB_DB_INSTANCE>
    <TARGET_COMMENT>${escapeXml(cklData.CHECKLIST.ASSET.TARGET_COMMENT)}</TARGET_COMMENT>
  </ASSET>
  <STIGS>
    <iSTIG version="${escapeXml(cklData.CHECKLIST.STIGS.iSTIG["@_version"])}">
      <STIG_INFO>
        <VERSION>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.VERSION)}</VERSION>
        <CLASSIFICATION>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.CLASSIFICATION)}</CLASSIFICATION>
        <STIG_ID>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.STIG_ID)}</STIG_ID>
        <TITLE>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.TITLE)}</TITLE>
        <DESCRIPTION>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.DESCRIPTION)}</DESCRIPTION>
        <FILENAME>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.FILENAME)}</FILENAME>
        <RELEASE_INFO>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.RELEASE_INFO)}</RELEASE_INFO>
        <SEVERITY>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.SEVERITY)}</SEVERITY>
        <STIG_UUID>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.STIG_UUID)}</STIG_UUID>
        <NOTICE>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.NOTICE)}</NOTICE>
        <SOURCE>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.SOURCE)}</SOURCE>
        <STIG_VIEWER_VERSION>${escapeXml(cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.STIG_VIEWER_VERSION)}</STIG_VIEWER_VERSION>
      </STIG_INFO>
      ${cklData.CHECKLIST.STIGS.iSTIG.VULN.map(vuln => `
      <VULN status="${escapeXml(vuln["@_status"])}">
        ${vuln.STIG_DATA.map(data => `
        <STIG_DATA>
          <VULN_ATTRIBUTE>${escapeXml(data.VULN_ATTRIBUTE)}</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${escapeXml(data.ATTRIBUTE_DATA)}</ATTRIBUTE_DATA>
        </STIG_DATA>`).join('')}
        <STATUS>${escapeXml(vuln.STATUS)}</STATUS>
        <FINDING_DETAILS>${escapeXml(vuln.FINDING_DETAILS)}</FINDING_DETAILS>
        <COMMENTS>${escapeXml(vuln.COMMENTS)}</COMMENTS>
        <SEVERITY>${escapeXml(vuln.SEVERITY)}</SEVERITY>
        <SEVERITY_OVERRIDE>${escapeXml(vuln.SEVERITY_OVERRIDE)}</SEVERITY_OVERRIDE>
        <SEVERITY_JUSTIFICATION>${escapeXml(vuln.SEVERITY_JUSTIFICATION)}</SEVERITY_JUSTIFICATION>
      </VULN>`).join('')}
    </iSTIG>
  </STIGS>
</CHECKLIST>`;

  return xmlString;
}

/**
 * Parses XML string into ParsedXml object
 * @param xmlString - The XML string to parse
 * @returns The parsed XML data
 */
export function parseXmlString(xmlString: string): ParsedXml {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  return parser.parse(xmlString);
} 