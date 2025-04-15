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
    
    const parsedXml = parser.parse(fileContent);
    
    // If it's a CKL file, we need to transform it to match our expected format
    if (file.name.endsWith(".ckl")) {
      // Check if it's a CKL file by looking for the CHECKLIST root element
      if (parsedXml.CHECKLIST) {
        // Transform CKL to our expected format
        const transformedXml = transformCklToXml(parsedXml);
        return {
          rawXml: fileContent,
          parsedXml: transformedXml,
        };
      }
    }
    
    return {
      rawXml: fileContent,
      parsedXml,
    };
  } catch (error) {
    console.error("Error processing file:", error);
    return { error: "Failed to process file. Please check if it's a valid XML or CKL file." };
  }
}

// Function to transform CKL format to our expected XML format
function transformCklToXml(cklData: CklData) {
  try {
    // Extract STIG information
    const stigInfo = cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO;
    const asset = cklData.CHECKLIST.ASSET;
    
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
        Rule: {
          severity: string;
          status: string;
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
        
        // Create a Group object that matches our expected format
        return {
          title: vulnData.Group_Title || "Unknown Group",
          description: "",
          "@_id": vulnData.Vuln_Num || `V-${Math.floor(Math.random() * 10000)}`,
          Rule: {
            severity: mapSeverity(vuln.SEVERITY || "unknown"),
            status: mapStatus(vuln.STATUS || "default")
          }
        };
      });
    }
    
    return benchmark;
  } catch (error) {
    console.error("Error transforming CKL data:", error);
    throw new Error("Failed to transform CKL data");
  }
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
  }
  
  return "open";
} 