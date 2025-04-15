import { XMLParser } from "fast-xml-parser";

interface StigData {
  VULN_ATTRIBUTE: string;
  ATTRIBUTE_DATA: string;
}

interface Vulnerability {
  STIG_DATA: StigData[];
  STATUS?: string;
  SEVERITY?: string;
  FINDING_DETAILS?: string;
  COMMENTS?: string;
}

interface StigInfo {
  TITLE: string;
  VERSION: string;
  RELEASE_INFO: string;
  SOURCE: string;
  STIG_ID?: string;
  DESCRIPTION?: string;
}

interface Asset {
  TARGET_COMMENT: string;
}

// Define the ParsedXml interface
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

export async function processXmlFile(file: File) {
  try {
    if (!file) {
      return { error: "No file provided" };
    }

    if (!file.name.endsWith(".xml") && !file.name.endsWith(".ckl")) {
      return { error: "Please upload an XML or CKL file" };
    }

    // Read the file content
    const fileContent = await file.text();
    
    // Parse the XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: true,
      trimValues: true,
    });
    
    let parsedXml;
    try {
      parsedXml = parser.parse(fileContent);
    } catch (parseError) {
      console.error("Error parsing XML:", parseError);
      return { error: "Failed to parse XML file. Please check if it's a valid XML file." };
    }
    
    // If it's a CKL file, we need to transform it to match our expected format
    if (file.name.endsWith(".ckl")) {
      // Check if it's a CKL file by looking for the CHECKLIST root element
      if (parsedXml.CHECKLIST) {
        try {
          // Transform CKL to our expected format
          const transformedXml = transformCklToXml(parsedXml);
          
          // Validate the transformed XML
          if (!transformedXml.Benchmark || !transformedXml.Benchmark.Group) {
            return { error: "Invalid CKL structure after transformation" };
          }
          
          return {
            rawXml: fileContent,
            parsedXml: transformedXml,
          };
        } catch (transformError) {
          console.error("Error transforming CKL:", transformError);
          return { error: `Failed to transform CKL file: ${transformError instanceof Error ? transformError.message : String(transformError)}` };
        }
      } else {
        return { error: "The file does not appear to be a valid CKL file (missing CHECKLIST element)" };
      }
    }
    
    // For regular XML files, validate the structure
    if (!parsedXml.Benchmark || !parsedXml.Benchmark.Group) {
      return { error: "The XML file does not contain the expected Benchmark and Group elements" };
    }
    
    return {
      rawXml: fileContent,
      parsedXml,
    };
  } catch (error) {
    console.error("Error processing file:", error);
    return { error: `Failed to process file: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function transformCklToXml(cklData: {
  CHECKLIST: {
    STIGS: {
      iSTIG: {
        STIG_INFO: StigInfo;
        VULN: Vulnerability[];
      };
    };
    ASSET: Asset;
  };
}): ParsedXml {
  try {
    // Validate CKL data structure
    if (!cklData.CHECKLIST?.STIGS?.iSTIG) {
      throw new Error("Invalid CKL format: Missing required STIGS structure");
    }

    const stigInfo = cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO;
    const vulnerabilities = cklData.CHECKLIST.STIGS.iSTIG.VULN || [];

    // Create benchmark object
    const benchmark: ParsedXml = {
      Benchmark: {
        "@_xmlns:xccdf": "http://checklists.nist.gov/xccdf/1.1",
        "@_xmlns:xhtml": "http://www.w3.org/1999/xhtml",
        "@_xmlns:dc": "http://purl.org/dc/elements/1.1/",
        "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "@_xsi:schemaLocation": "http://checklists.nist.gov/xccdf/1.1 xccdf_checklist.1.1.xsd",
        "@_id": stigInfo.STIG_ID || "benchmark-1",
        "plain-text": {
          "#text": stigInfo.VERSION || "1.0"
        },
        title: stigInfo.TITLE || "STIG Benchmark",
        description: stigInfo.DESCRIPTION || "",
        status: {
          "#text": stigInfo.RELEASE_INFO || "draft",
          "@_date": new Date().toISOString()
        },
        reference: {
          "#text": stigInfo.SOURCE || "",
          "@_href": ""
        },
        Group: vulnerabilities.map((vuln: Vulnerability) => {
          const stigData = vuln.STIG_DATA.reduce((acc: Record<string, string>, curr: StigData) => {
            acc[curr.VULN_ATTRIBUTE] = curr.ATTRIBUTE_DATA;
            return acc;
          }, {});

          return {
            "@_id": stigData.Vuln_Num,
            title: stigData.Group_Title,
            description: stigData.Vuln_Discuss,
            Rule: {
              "@_id": stigData.Rule_ID,
              "@_severity": vuln.SEVERITY?.toLowerCase() || "medium",
              version: stigData.Rule_Ver,
              title: stigData.Rule_Title,
              description: stigData.Vuln_Discuss,
              check: {
                "check-content": stigData.Check_Content
              },
              fixtext: {
                "#text": stigData.Fix_Text
              }
            },
            status: vuln.STATUS || "default",
            findingDetails: vuln.FINDING_DETAILS || "",
            comments: vuln.COMMENTS || ""
          };
        })
      }
    };

    return benchmark;
  } catch (error) {
    console.error("Error transforming CKL to XML:", error);
    throw error;
  }
} 