/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Upload, Search, SortAsc, SortDesc, Group, Download, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { processXmlFile } from "@/lib/xmlUtils";
import { XMLParser } from "fast-xml-parser";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Define types for our data
type Severity = "high" | "medium" | "low" | "unknown";
type SortField = "title" | "severity" | "id";
type SortOrder = "asc" | "desc";
type GroupBy = "severity" | "none";
type StatusValue = "Open" | "NotAFinding" | "Not_Applicable" | "Not_Reviewed";
type StatusFilter = "all" | StatusValue;
type FileType = "xml" | "ckl" | null;

// Status mapping for display values
const STATUS_MAPPING = {
  "Open": "Open",
  "NotAFinding": "Not a Finding",
  "Not_Applicable": "Not Applicable",
  "Not_Reviewed": "Not Reviewed"
} as const;

interface Ident {
  "#text": string;
  "@_system": string;
}

interface Rule {
  version: string;
  title: string;
  description: string;
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
  "@_severity": Severity;
}

interface Group {
  title: string;
  description: string;
  Rule: Rule;
  "@_id": string;
  status?: StatusValue;
  findingDetails?: string;
  comments?: string;
}

interface Benchmark {
  title: string;
  description: string;
  "plain-text": { "#text": string };
  status: { "#text": string; "@_date": string };
  reference: { "#text": string; "@_href": string };
  Group: Group[];
  "@_id"?: string;
}

interface ParsedXml {
  Benchmark: Benchmark;
}

// Add StatisticsCard component before the XmlViewer component
interface StatisticsCardProps {
  groups: Group[];
  groupFields: Record<string, {
    status: StatusValue;
    findingDetails: string;
    comments: string;
  }>;
}

function StatisticsCard({ groups, groupFields }: StatisticsCardProps) {
  // Calculate statistics
  const severityData = groups.reduce((acc, group) => {
    const severity = group.Rule["@_severity"] || "unknown";
    const groupId = group["@_id"];
    const status = groupFields[groupId]?.status || "Not_Reviewed";
    
    // Only count findings that are still "Open"
    if (status === "Open") {
      acc[severity] = (acc[severity] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const statusData = groups.reduce((acc, group) => {
    const groupId = group["@_id"];
    const status = groupFields[groupId]?.status || "Not_Reviewed";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Findings Statistics</CardTitle>
        <CardDescription>Overview of findings by severity and status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Progress Status</h3>
            <div className="h-[200px]">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusData).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>{STATUS_MAPPING[status as keyof typeof STATUS_MAPPING] || status}</span>
                    <Badge>{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Open Findings by Severity</h3>
            <div className="h-[200px]">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(severityData).map(([severity, count]) => (
                  <div key={severity} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="capitalize">{severity}</span>
                    <Badge>{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function XmlViewer() {
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [parsedXml, setParsedXml] = useState<ParsedXml | null>(null);
  const [fileType, setFileType] = useState<FileType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Reference to the file input element
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New state for filtering, sorting, and grouping
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  
  // New state for editable fields
  const [groupFields, setGroupFields] = useState<Record<string, {
    status: StatusValue;
    findingDetails: string;
    comments: string;
  }>>({});

  // Track which cards have unsaved changes
  const [cardsWithChanges, setCardsWithChanges] = useState<Set<string>>(new Set());

  // New state for debouncing
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  // Add debounced input handlers for textareas
  const debouncedInputHandlers = useRef<Record<string, NodeJS.Timeout>>({});

  // Function to handle debounced input changes
  const handleDebouncedInputChange = (groupId: string) => {
    // Clear any existing timeout for this group
    if (debouncedInputHandlers.current[groupId]) {
      clearTimeout(debouncedInputHandlers.current[groupId]);
    }
    
    // Set a new timeout to mark the card as changed after 500ms of no typing
    debouncedInputHandlers.current[groupId] = setTimeout(() => {
      markCardAsChanged(groupId);
    }, 500);
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    const currentHandlers = debouncedInputHandlers.current;
    return () => {
      Object.values(currentHandlers).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Load saved data from localStorage on component mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedXmlContent = localStorage.getItem("xmlContent");
    const savedParsedXml = localStorage.getItem("parsedXml");
    const savedFileType = localStorage.getItem("fileType");
    const savedFilters = localStorage.getItem("xmlFilters");
    const savedGroupFields = localStorage.getItem("groupFields");
    
    if (savedXmlContent && savedParsedXml) {
      setXmlContent(savedXmlContent);
      const parsedData = JSON.parse(savedParsedXml);
      setParsedXml(parsedData);
      
      if (savedFileType) {
        setFileType(savedFileType as FileType);
      }
      
      // Initialize groupFields with data from CKL if available
      if (parsedData.Benchmark && parsedData.Benchmark.Group) {
        const initialGroupFields: Record<string, {
          status: StatusValue;
          findingDetails: string;
          comments: string;
        }> = {};
        
        parsedData.Benchmark.Group.forEach((group: Group) => {
          const groupId = group["@_id"];
          if (group.status || group.findingDetails || group.comments) {
            initialGroupFields[groupId] = {
              status: group.status || "Not_Reviewed",
              findingDetails: group.findingDetails || "",
              comments: group.comments || ""
            };
          }
        });
        
        // Only update if we have new data and no saved data
        if (Object.keys(initialGroupFields).length > 0 && !savedGroupFields) {
          setGroupFields(initialGroupFields);
        }
      }
    }
    
    if (savedFilters) {
      const filters = JSON.parse(savedFilters);
      setSearchTerm(filters.searchTerm || "");
      setSeverityFilter(filters.severityFilter || "all");
      setStatusFilter(filters.statusFilter || "all");
      setSortField(filters.sortField || "title");
      setSortOrder(filters.sortOrder || "asc");
      setGroupBy(filters.groupBy || "none");
    }

    if (savedGroupFields) {
      setGroupFields(JSON.parse(savedGroupFields));
    }
  }, []);

  // Save data to localStorage when it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (xmlContent && parsedXml) {
      localStorage.setItem("xmlContent", xmlContent);
      localStorage.setItem("parsedXml", JSON.stringify(parsedXml));
    }
    
    if (fileType) {
      localStorage.setItem("fileType", fileType);
    }
  }, [xmlContent, parsedXml, fileType]);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const filters = {
      searchTerm,
      severityFilter,
      statusFilter,
      sortField,
      sortOrder,
      groupBy
    };
    localStorage.setItem("xmlFilters", JSON.stringify(filters));
  }, [searchTerm, severityFilter, statusFilter, sortField, sortOrder, groupBy]);

  // Save group fields to localStorage when they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem("groupFields", JSON.stringify(groupFields));
  }, [groupFields]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Memoize filtered and sorted groups
  const filteredAndSortedGroups = parsedXml?.Benchmark?.Group.filter(group => {
    // Apply search filter
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      const matchesSearch = 
        group.title.toLowerCase().includes(term) || 
        group.Rule.title.toLowerCase().includes(term) ||
        (typeof group.Rule.description === 'string' && 
         group.Rule.description.toLowerCase().includes(term));
      
      if (!matchesSearch) return false;
    }
    
    // Apply severity filter
    if (severityFilter !== "all") {
      if (group.Rule["@_severity"] !== severityFilter) return false;
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      const groupId = group["@_id"];
      const status = group.status || groupFields[groupId]?.status || "Not_Reviewed";
      if (status !== statusFilter) return false;
    }
    
    return true;
  }).sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "severity":
        const severityOrder = { high: 0, medium: 1, low: 2, unknown: 3 };
        const severityA = a.Rule["@_severity"] || "unknown";
        const severityB = b.Rule["@_severity"] || "unknown";
        comparison = (severityOrder[severityA] || 3) - (severityOrder[severityB] || 3);
        break;
      case "id":
        comparison = a["@_id"].localeCompare(b["@_id"]);
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === "asc" ? comparison : -comparison;
  }) || [];

  // Function to mark a card as having changes
  const markCardAsChanged = (groupId: string) => {
    setCardsWithChanges(prev => {
      const newSet = new Set(prev);
      newSet.add(groupId);
      return newSet;
    });
  };

  // Function to save changes for a specific group
  const saveChanges = (groupId: string, changes: {
    status?: StatusValue;
    findingDetails?: string;
    comments?: string;
  }) => {
    setGroupFields(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        ...changes
      }
    }));
    
    // Remove the card from the set of cards with changes
    setCardsWithChanges(prev => {
      const newSet = new Set(prev);
      newSet.delete(groupId);
      return newSet;
    });
  };

  // Function to handle saving a specific group's changes
  const handleSaveGroup = (groupId: string) => {
    // Get the current values from the DOM directly
    const findingDetailsTextarea = document.getElementById(`findingDetails-${groupId}`) as HTMLTextAreaElement;
    const commentsTextarea = document.getElementById(`comments-${groupId}`) as HTMLTextAreaElement;
    
    if (!findingDetailsTextarea || !commentsTextarea) return;
    
    // Get the current status from the groupFields state
    const currentStatus = groupFields[groupId]?.status || "Not_Reviewed";
    
    const changes = {
      status: currentStatus,
      findingDetails: findingDetailsTextarea.value,
      comments: commentsTextarea.value
    };
    
    saveChanges(groupId, changes);
  };

  // Function to parse XML content if it's a string
  const parseXmlString = (xmlString: string) => {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
      });
      return parser.parse(xmlString);
    } catch (error) {
      console.error("Error parsing XML string:", error);
      return null;
    }
  };

  // Function to check if a string is XML
  const isXmlString = (str: string) => {
    return /<[a-z][\s\S]*>/i.test(str);
  };

  // Function to render description content
  const renderDescription = (description: string) => {
    if (typeof description === "string") {
      if (isXmlString(description)) {
        const parsedDesc = parseXmlString(description);
        return parsedDesc;
      }
      return null;
    }
    return null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await processXmlFile(file);
      
      if (result.error) {
        setError(result.error);
        return;
      }

      // Validate the parsed XML structure
      if (!result.parsedXml || !result.parsedXml.Benchmark || !result.parsedXml.Benchmark.Group) {
        setError("Invalid XML structure. The file does not contain the expected Benchmark and Group elements.");
        return;
      }

      setXmlContent(result.rawXml || null);
      setParsedXml(result.parsedXml || null);
      
      // Determine file type
      const fileType = file.name.endsWith(".ckl") ? "ckl" : "xml";
      setFileType(fileType);
      
      // Initialize groupFields with data from the parsed XML
      if (result.parsedXml.Benchmark.Group) {
        const initialGroupFields: Record<string, {
          status: StatusValue;
          findingDetails: string;
          comments: string;
        }> = {};
        
        result.parsedXml.Benchmark.Group.forEach((group: Group) => {
          const groupId = group["@_id"];
          initialGroupFields[groupId] = {
            status: group.status || "Not_Reviewed",
            findingDetails: group.findingDetails || "",
            comments: group.comments || ""
          };
        });
        
        setGroupFields(initialGroupFields);
      }
    } catch (err) {
      setError("Failed to process file. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to trigger file input click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Function to get severity color
  const getSeverityColor = (severity: Severity | undefined) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Function to render a single group card
  const renderGroupCard = (group: Group) => {
    const groupId = group["@_id"];
    
    // Use status from the group object if available, otherwise use from groupFields
    const currentFields = {
      status: group.status || groupFields[groupId]?.status || "Not_Reviewed",
      findingDetails: group.findingDetails || groupFields[groupId]?.findingDetails || "",
      comments: group.comments || groupFields[groupId]?.comments || ""
    };
    
    // Determine if this card has unsaved changes
    const hasUnsavedChanges = cardsWithChanges.has(groupId);

    return (
      <Card key={groupId} className={`border-l-4 ${group.Rule["@_severity"] === "high" ? "border-l-red-500" : 
                                                    group.Rule["@_severity"] === "medium" ? "border-l-yellow-500" : 
                                                    group.Rule["@_severity"] === "low" ? "border-l-green-500" : 
                                                    "border-l-blue-500"}`}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{group.title}</CardTitle>
              <CardDescription className="mt-1">{group.Rule.title}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Button 
                  size="sm" 
                  onClick={() => handleSaveGroup(groupId)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Save Changes
                </Button>
              )}
              <Badge className={`${getSeverityColor(group.Rule["@_severity"])}`}>
                {group.Rule["@_severity"]?.toUpperCase() || "UNKNOWN"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {Array.isArray(group.Rule.ident) ? 
              group.Rule.ident.map((id: { "#text": string }, index: number) => (
                <Badge key={index} variant="outline">{id["#text"]}</Badge>
              )) : 
              group.Rule.ident && (
                <Badge variant="outline">{group.Rule.ident["#text"]}</Badge>
              )
            }
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side - Content */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Vulnerability Discussion</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {renderDescription(group.Rule.description)?.VulnDiscussion || "No discussion available"}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Check Content</h4>
                <p className="text-sm text-gray-700">
                  {group.Rule.check["check-content"] || "No check content available"}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Fix Text</h4>
                <p className="text-sm text-gray-700">
                  {group.Rule.fixtext["#text"] || "No fix text available"}
                </p>
              </div>
            </div>

            {/* Right side - Input fields */}
            <div className="space-y-4 border-l pl-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Status</h4>
                  <Select
                    value={currentFields.status}
                    onValueChange={(value) => {
                      markCardAsChanged(groupId);
                      saveChanges(groupId, { status: value as StatusValue });
                    }}
                  >
                    <SelectTrigger id={`status-${groupId}`} className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="NotAFinding">Not a Finding</SelectItem>
                      <SelectItem value="Not_Applicable">Not Applicable</SelectItem>
                      <SelectItem value="Not_Reviewed">Not Reviewed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Finding Details</h4>
                  <textarea
                    id={`findingDetails-${groupId}`}
                    className="w-full min-h-[100px] p-2 border rounded-md"
                    defaultValue={currentFields.findingDetails}
                    placeholder="Enter finding details..."
                    onChange={() => handleDebouncedInputChange(groupId)}
                  />
                </div>

                <div>
                  <h4 className="font-medium mb-2">Comments</h4>
                  <textarea
                    id={`comments-${groupId}`}
                    className="w-full min-h-[100px] p-2 border rounded-md"
                    defaultValue={currentFields.comments}
                    placeholder="Enter comments..."
                    onChange={() => handleDebouncedInputChange(groupId)}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Function to render groups based on grouping
  const renderGroups = () => {
    if (groupBy === "none") {
      return filteredAndSortedGroups.map((group) => renderGroupCard(group));
    }
    
    // Group by severity
    const groupedBySeverity: Record<string, Group[]> = {};
    
    filteredAndSortedGroups.forEach(group => {
      const severity = group.Rule["@_severity"] || "unknown";
      if (!groupedBySeverity[severity]) {
        groupedBySeverity[severity] = [];
      }
      groupedBySeverity[severity].push(group);
    });
    
    return Object.entries(groupedBySeverity).map(([severity, groups]) => (
      <div key={severity} className="mb-6">
        <h3 className="text-xl font-bold mb-3 capitalize">{severity} Severity</h3>
        <div className="space-y-4">
          {groups.map(group => renderGroupCard(group))}
        </div>
      </div>
    ));
  };

  // Function to save the CKL file
  const handleSaveCkl = () => {
    if (!parsedXml) return;
    
    // Create a deep copy of the parsed XML to avoid modifying the original
    const updatedParsedXml = JSON.parse(JSON.stringify(parsedXml));
    
    // Update the group fields with the latest values from the UI
    if (updatedParsedXml.Benchmark && updatedParsedXml.Benchmark.Group) {
      updatedParsedXml.Benchmark.Group.forEach((group: Group) => {
        const groupId = group["@_id"];
        if (groupFields[groupId]) {
          group.status = groupFields[groupId].status;
          group.findingDetails = groupFields[groupId].findingDetails;
          group.comments = groupFields[groupId].comments;
        }
      });
    }
    
    // Convert the updated XML to CKL format
    const cklData = convertXmlToCkl(updatedParsedXml);
    
    // Convert the CKL data to XML string
    const xmlString = convertCklToXmlString(cklData);
    
    // Create a Blob with the XML data
    const blob = new Blob([xmlString], { type: 'application/xml' });
    
    // Create a URL for the Blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stig-checklist.ckl';
    
    // Append the link to the document, click it, and remove it
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Release the URL
    URL.revokeObjectURL(url);
  };

  // Function to convert XML to CKL format
  const convertXmlToCkl = (xmlData: ParsedXml) => {
    // This is a simplified conversion - in a real implementation, you would use the Python code you provided
    // For now, we'll create a basic CKL structure
    
    const cklData = {
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
              DESCRIPTION: xmlData.Benchmark.description
            },
            VULN: xmlData.Benchmark.Group.map(group => {
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
              
              return {
                STIG_DATA: stigData,
                STATUS: group.status || groupFields[group["@_id"]]?.status || "Not_Reviewed",
                SEVERITY: group.Rule["@_severity"],
                FINDING_DETAILS: group.findingDetails || groupFields[group["@_id"]]?.findingDetails || "",
                COMMENTS: group.comments || groupFields[group["@_id"]]?.comments || ""
              };
            })
          }
        }
      }
    };
    
    return cklData;
  };

  // Function to convert CKL data to XML string
  const convertCklToXmlString = (cklData: any) => {
    // This is a simplified conversion - in a real implementation, you would use the Python code you provided
    // For now, we'll create a basic XML string
    
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
      xmlString += `        <SI_DATA>\n`;
      xmlString += `          <SID_NAME>${key}</SID_NAME>\n`;
      xmlString += `          <SID_DATA>${value}</SID_DATA>\n`;
      xmlString += `        </SI_DATA>\n`;
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
      xmlString += `        <STATUS>${vuln.STATUS}</STATUS>\n`;
      xmlString += `        <SEVERITY>${vuln.SEVERITY}</SEVERITY>\n`;
      xmlString += `        <FINDING_DETAILS>${vuln.FINDING_DETAILS}</FINDING_DETAILS>\n`;
      xmlString += `        <COMMENTS>${vuln.COMMENTS}</COMMENTS>\n`;
      
      xmlString += '      </VULN>\n';
    }
    
    xmlString += '    </iSTIG>\n';
    xmlString += '  </STIGS>\n';
    xmlString += '</CHECKLIST>';
    
    return xmlString;
  };

  // Function to clear all current data
  const clearCurrentData = () => {
    // Clear state
    setXmlContent(null);
    setParsedXml(null);
    setFileType(null);
    setError(null);
    setSearchTerm("");
    setSeverityFilter("all");
    setStatusFilter("all");
    setSortField("title");
    setSortOrder("asc");
    setGroupBy("none");
    setGroupFields({});
    setCardsWithChanges(new Set());
    
    // Clear localStorage
    localStorage.removeItem("xmlContent");
    localStorage.removeItem("parsedXml");
    localStorage.removeItem("fileType");
    localStorage.removeItem("xmlFilters");
    localStorage.removeItem("groupFields");
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 px-4 min-w-full min-w-full overflow-x-hidden overflow-y-visible mt-4">
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        <Card className="w-full lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle>Upload STIG File</CardTitle>
            <CardDescription>
              Upload an XML or CKL file to view and edit its contents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="xml-file">XML/CKL File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="xml-file"
                  type="file"
                  accept=".xml,.ckl"
                  onChange={handleFileChange}
                  disabled={isLoading}
                  ref={fileInputRef}
                  className="hidden"
                />
                <Button 
                  onClick={handleUploadClick} 
                  disabled={isLoading}
                  className="w-full"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
              </div>
              {xmlContent && parsedXml && (
                <div className="mt-2 space-y-2">
                  <div className="text-sm text-muted-foreground truncate">
                    <span className="font-medium">Current file:</span> {fileInputRef.current?.files?.[0]?.name || "Unknown"}
                    <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                      {fileType === "xml" ? "XML" : "CKL"}
                    </span>
                  </div>
                  
                  {fileType === "xml" && (
                    <div className="text-xs text-muted-foreground">
                      XML file will be converted to CKL format for editing
                    </div>
                  )}
                  
                  <Button onClick={handleSaveCkl} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Save as CKL
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Current
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear all current data including any changes you{"'"}ve made. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={clearCurrentData}>Clear Data</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {xmlContent && parsedXml && (
          <div className="lg:col-span-7">
            <StatisticsCard 
              groups={parsedXml.Benchmark.Group} 
              groupFields={groupFields}
            />
          </div>
        )}
      </div>

      {error && (
        <Card className="w-full border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {xmlContent && parsedXml && parsedXml.Benchmark && parsedXml.Benchmark.Group && (
        <>
          <Card className="w-full">
            <CardHeader className="py-4">
              <div className="flex justify-between items-center">
                <CardTitle>Filters & Sorting</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  className="flex items-center gap-1"
                >
                  {isFiltersExpanded ? (
                    <>
                      <span className="text-sm">Collapse</span>
                      <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <span className="text-sm">Expand</span>
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            {isFiltersExpanded && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                      <Input
                        id="search"
                        placeholder="Search by title or content..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2 min-w-full">
                    <Label htmlFor="severity">Severity Filter</Label>
                    <Select
                      value={severityFilter}
                      onValueChange={(value) => setSeverityFilter(value as Severity | "all")}
                    >
                      <SelectTrigger id="severity" className="w-full">
                        <SelectValue placeholder="Filter by severity" />
                      </SelectTrigger>
                      <SelectContent className="w-full">
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2 min-w-full">
                    <Label htmlFor="status">Status Filter</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                    >
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent className="w-full">
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="NotAFinding">Not a Finding</SelectItem>
                        <SelectItem value="Not_Applicable">Not Applicable</SelectItem>
                        <SelectItem value="Not_Reviewed">Not Reviewed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2 min-w-full">
                    <Label htmlFor="sort">Sort By</Label>
                    <div className="flex gap-2">
                      <Select
                        value={sortField}
                        onValueChange={(value) => setSortField(value as SortField)}
                      >
                        <SelectTrigger id="sort" className="w-full">
                          <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent className="w-full">
                          <SelectItem value="title">Title</SelectItem>
                          <SelectItem value="severity">Severity</SelectItem>
                          <SelectItem value="id">ID</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      >
                        {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 min-w-full">
                    <Label htmlFor="group">Group By</Label>
                    <Select
                      value={groupBy}
                      onValueChange={(value) => setGroupBy(value as GroupBy)}
                    >
                      <SelectTrigger id="group" className="w-full">
                        <SelectValue placeholder="Group by" />
                      </SelectTrigger>
                      <SelectContent className="w-full">
                        <SelectItem value="none">No Grouping</SelectItem>
                        <SelectItem value="severity">Severity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <Card className="w-full">
            <CardHeader>
              <CardTitle>{parsedXml.Benchmark.title}</CardTitle>
              <CardDescription>{parsedXml.Benchmark.description}</CardDescription>
              <div className="flex flex-row gap-2">
                <Badge>{parsedXml.Benchmark["plain-text"]["#text"]} {parsedXml.Benchmark.status["@_date"]}</Badge>  
                <Badge>{parsedXml.Benchmark.status["#text"]} {parsedXml.Benchmark.status["@_date"]}</Badge>
                <Badge>{parsedXml.Benchmark.reference["#text"]} {parsedXml.Benchmark.reference["@_href"]}</Badge>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium">Results ({filteredAndSortedGroups.length} of {parsedXml.Benchmark.Group.length})</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {parsedXml.Benchmark.Group.filter(group => !groupFields[group["@_id"]]?.status).length} findings with default status
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {renderGroups()}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
} 