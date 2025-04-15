// eslint-disable-file @typescript-eslint/no-explicit-any  
"use server";

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
}

interface Asset {
  TARGET_COMMENT: string;
}

interface CklData {
  CHECKLIST: {
    STIGS: {
      iSTIG: {
        STIG_INFO: StigInfo;
        VULN: Vulnerability[];
      };
    };
    ASSET: Asset;
  };
}

export async function uploadXmlFile(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    
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

// Function to transform CKL format to our expected XML format
function transformCklToXml(cklData: CklData): ParsedXml {
  try {
    // Validate the CKL data structure
    if (!cklData.CHECKLIST || !cklData.CHECKLIST.STIGS || !cklData.CHECKLIST.STIGS.iSTIG) {
      throw new Error("Invalid CKL structure: Missing required elements");
    }
    
    // Extract STIG information
    const stigInfo = cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO;
    const asset = cklData.CHECKLIST.ASSET;
    
    if (!stigInfo || !asset) {
      throw new Error("Invalid CKL structure: Missing STIG_INFO or ASSET");
    }
    
    // Create a Benchmark object that matches our expected format
    const benchmark = {
      title: stigInfo.TITLE || "Unknown STIG",
      description: asset.TARGET_COMMENT || "",
      "plain-text": { "#text": stigInfo.VERSION || "Unknown Version" },
      status: { 
        "#text": stigInfo.RELEASE_INFO || "Unknown Release", 
        "@_date": new Date().toISOString().split('T')[0] 
      },
      reference: { 
        "#text": stigInfo.SOURCE || "Unknown Source", 
        "@_href": "" 
      },
      Group: [] as Array<{
        title: string;
        description: string;
        "@_id": string;
        status?: string;
        findingDetails?: string;
        comments?: string;
        Rule: {
          version: string;
          title: string;
          description: string;
          reference: string;
          ident: any;
          fixtext: any;
          fix: any;
          check: any;
          "@_id": string;
          "@_weight": number;
          "@_severity": string;
        };
      }>
    };
    
    // Process vulnerabilities
    const vulns = cklData.CHECKLIST.STIGS.iSTIG.VULN;
    if (Array.isArray(vulns)) {
      benchmark.Group = vulns.map((vuln) => {
        // Extract STIG data
        const stigData = vuln.STIG_DATA;
        const vulnData: Record<string, string> = {};
        
        // Convert STIG_DATA to a more usable format
        if (Array.isArray(stigData)) {
          stigData.forEach((data) => {
            if (data.VULN_ATTRIBUTE && data.ATTRIBUTE_DATA) {
              vulnData[data.VULN_ATTRIBUTE] = data.ATTRIBUTE_DATA;
            }
          });
        }
        
        // Extract status, finding details, and comments
        const status = vuln.STATUS ? mapStatus(vuln.STATUS) : "default";
        const findingDetails = vuln.FINDING_DETAILS || "";
        const comments = vuln.COMMENTS || "";
        
        // Create a Group object that matches our expected format
        return {
          title: vulnData.Group_Title || "Unknown Group",
          description: vulnData.Vuln_Discuss || "",
          "@_id": vulnData.Vuln_Num || `V-${Math.floor(Math.random() * 10000)}`,
          status: status,
          findingDetails: findingDetails,
          comments: comments,
          Rule: {
            version: vulnData.Rule_Ver || "1.0",
            title: vulnData.Rule_Title || "Unknown Rule",
            description: vulnData.Vuln_Discuss || "",
            reference: vulnData.Rule_ID || "",
            ident: { "#text": vulnData.Rule_ID || "", "@_system": "http://iase.disa.mil/cci" },
            fixtext: { "#text": vulnData.Fix_Text || "", "@_fixref": "" },
            fix: { "@_id": "" },
            check: { 
              "check-content-ref": { "@_href": "", "@_name": "" }, 
              "check-content": vulnData.Check_Content || "", 
              "@_system": "" 
            },
            "@_id": vulnData.Rule_ID || "",
            "@_weight": 0,
            "@_severity": mapSeverity(vuln.SEVERITY || "unknown")
          }
        };
      });
    } else {
      // If there are no vulnerabilities, create an empty array
      benchmark.Group = [];
    }
    
    // Return the benchmark wrapped in a ParsedXml structure
    return { Benchmark: benchmark };
  } catch (error) {
    console.error("Error transforming CKL data:", error);
    throw new Error("Failed to transform CKL data: " + (error instanceof Error ? error.message : String(error)));
  }
}

// Define the ParsedXml interface
interface ParsedXml {
  Benchmark: {
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
        description: string;
        reference: string;
        ident: any;
        fixtext: any;
        fix: any;
        check: any;
        "@_id": string;
        "@_weight": number;
        "@_severity": string;
      };
    }>;
  };
}

// Helper function to map CKL severity to our severity format
function mapSeverity(severity: string): "high" | "medium" | "low" | "unknown" {
  if (!severity) return "unknown";
  
  const lowerSeverity = severity.toLowerCase();
  if (lowerSeverity.includes("high") || lowerSeverity === "i") {
    return "high";
  } else if (lowerSeverity.includes("medium") || lowerSeverity === "ii") {
    return "medium";
  } else if (lowerSeverity.includes("low") || lowerSeverity === "iii") {
    return "low";
  }
  
  return "unknown";
}

// Helper function to map CKL status to our status format
function mapStatus(status: string): "not applicable" | "not finding" | "open" | "default" {
  if (!status) return "default";
  
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes("not applicable") || lowerStatus === "na") {
    return "not applicable";
  } else if (lowerStatus.includes("not finding") || lowerStatus === "nf") {
    return "not finding";
  } else if (lowerStatus.includes("open") || lowerStatus === "o") {
    return "open";
  }
  
  return "default";
} 