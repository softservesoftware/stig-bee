"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Upload, Search, SortAsc, SortDesc, Group, Download, Trash2 } from "lucide-react";
import { uploadXmlFile } from "@/lib/actions";
import { XMLParser } from "fast-xml-parser";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
type StatusFilter = "all" | "not applicable" | "not finding" | "open" | "default";

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
  status?: "not applicable" | "not finding" | "open" | "default";
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
}

interface ParsedXml {
  Benchmark: Benchmark;
}

// Add StatisticsCard component before the XmlViewer component
interface StatisticsCardProps {
  groups: Group[];
  groupFields: Record<string, {
    status: "not applicable" | "not finding" | "open" | "default";
    findingDetails: string;
    comments: string;
  }>;
}

function StatisticsCard({ groups, groupFields }: StatisticsCardProps) {
  // Calculate statistics
  const severityData = groups.reduce((acc, group) => {
    const severity = group.Rule["@_severity"] || "unknown";
    const groupId = group["@_id"];
    const status = groupFields[groupId]?.status || "default";
    
    // Only count findings that are still "open"
    if (status === "open") {
      acc[severity] = (acc[severity] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const statusData = groups.reduce((acc, group) => {
    const groupId = group["@_id"];
    const status = groupFields[groupId]?.status || "default";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Transform data for charts
  const severityChartData = Object.entries(severityData).map(([name, value]) => ({
    name,
    value,
  }));

  const statusChartData = Object.entries(statusData).map(([name, value]) => ({
    name,
    value,
  }));

  // Colors for charts
  const severityColors = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#22c55e",
    unknown: "#6b7280",
  };

  const statusColors = {
    open: "#ef4444",
    "not finding": "#22c55e",
    "not applicable": "#6b7280",
    "default": "#94a3b8",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Findings Statistics</CardTitle>
        <CardDescription>Overview of findings by severity and status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Progress Status</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={statusColors[entry.name as keyof typeof statusColors]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Findings by Severity</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8">
                    {severityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={severityColors[entry.name as keyof typeof severityColors]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
  
  // New state for editable fields
  const [groupFields, setGroupFields] = useState<Record<string, {
    status: "not applicable" | "not finding" | "open" | "default";
    findingDetails: string;
    comments: string;
  }>>({});

  // Track which cards have unsaved changes
  const [cardsWithChanges, setCardsWithChanges] = useState<Set<string>>(new Set());

  // New state for debouncing
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const savedXmlContent = localStorage.getItem("xmlContent");
    const savedParsedXml = localStorage.getItem("parsedXml");
    const savedFilters = localStorage.getItem("xmlFilters");
    const savedGroupFields = localStorage.getItem("groupFields");
    
    if (savedXmlContent && savedParsedXml) {
      setXmlContent(savedXmlContent);
      const parsedData = JSON.parse(savedParsedXml);
      setParsedXml(parsedData);
      
      // Initialize groupFields with data from CKL if available
      if (parsedData.Benchmark && parsedData.Benchmark.Group) {
        const initialGroupFields: Record<string, {
          status: "not applicable" | "not finding" | "open" | "default";
          findingDetails: string;
          comments: string;
        }> = {};
        
        parsedData.Benchmark.Group.forEach((group: Group) => {
          const groupId = group["@_id"];
          if (group.status || group.findingDetails || group.comments) {
            initialGroupFields[groupId] = {
              status: group.status || "default",
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
    if (xmlContent && parsedXml) {
      localStorage.setItem("xmlContent", xmlContent);
      localStorage.setItem("parsedXml", JSON.stringify(parsedXml));
    }
  }, [xmlContent, parsedXml]);

  // Save filters to localStorage when they change
  useEffect(() => {
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
  const filteredAndSortedGroups = useMemo(() => {
    if (!parsedXml?.Benchmark?.Group) return [];
    
    let filteredGroups = [...parsedXml.Benchmark.Group];
    
    // Apply search filter
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      filteredGroups = filteredGroups.filter(group => 
        group.title.toLowerCase().includes(term) || 
        group.Rule.title.toLowerCase().includes(term) ||
        (typeof group.Rule.description === 'string' && 
         group.Rule.description.toLowerCase().includes(term))
      );
    }
    
    // Apply severity filter
    if (severityFilter !== "all") {
      filteredGroups = filteredGroups.filter(group => 
        group.Rule["@_severity"] === severityFilter
      );
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filteredGroups = filteredGroups.filter(group => {
        const groupId = group["@_id"];
        const status = group.status || groupFields[groupId]?.status;
        
        if (statusFilter === "default") {
          return !status;
        } else {
          return status === statusFilter;
        }
      });
    }
    
    // Apply sorting
    filteredGroups.sort((a, b) => {
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
    });
    
    return filteredGroups;
  }, [parsedXml?.Benchmark?.Group, debouncedSearchTerm, severityFilter, statusFilter, sortField, sortOrder, groupFields]);

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
    status?: "not applicable" | "not finding" | "open" | "default";
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
  function renderDescription(description: string) {
    if (typeof description === "string") {
      if (isXmlString(description)) {
        const parsedDesc = parseXmlString(description);
        return parsedDesc;
      }
      return null;
    }
    return null;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadXmlFile(formData);
      
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
      
      // Initialize groupFields with data from the parsed XML
      if (result.parsedXml.Benchmark.Group) {
        const initialGroupFields: Record<string, {
          status: "not applicable" | "not finding" | "open" | "default";
          findingDetails: string;
          comments: string;
        }> = {};
        
        result.parsedXml.Benchmark.Group.forEach((group: Group) => {
          const groupId = group["@_id"];
          initialGroupFields[groupId] = {
            status: group.status || "default",
            findingDetails: group.findingDetails || "",
            comments: group.comments || ""
          };
        });
        
        setGroupFields(initialGroupFields);
      }
      
      console.log(JSON.stringify(result.parsedXml));
    } catch (err) {
      setError("Failed to process XML file. Please try again.");
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
  const renderGroupCard = useCallback((group: Group) => {
    const groupId = group["@_id"];
    
    // Use status from the group object if available, otherwise use from groupFields
    const currentFields = {
      status: group.status || groupFields[groupId]?.status || "default",
      findingDetails: group.findingDetails || groupFields[groupId]?.findingDetails || "",
      comments: group.comments || groupFields[groupId]?.comments || ""
    };
    
    // Determine if this card has unsaved changes
    const hasUnsavedChanges = cardsWithChanges.has(groupId);

    // Create a memoized save handler for this card
    const handleSave = () => {
      // Get the current values from the DOM directly
      const statusSelect = document.getElementById(`status-${groupId}`) as HTMLSelectElement;
      const findingDetailsTextarea = document.getElementById(`findingDetails-${groupId}`) as HTMLTextAreaElement;
      const commentsTextarea = document.getElementById(`comments-${groupId}`) as HTMLTextAreaElement;
      
      if (!statusSelect || !findingDetailsTextarea || !commentsTextarea) return;
      
      const changes = {
        status: statusSelect.value as "not applicable" | "not finding" | "open" | "default",
        findingDetails: findingDetailsTextarea.value,
        comments: commentsTextarea.value
      };
      
      saveChanges(groupId, changes);
    };

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
                  onClick={handleSave}
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
                  <select
                    id={`status-${groupId}`}
                    className="w-full p-2 border rounded-md"
                    defaultValue={currentFields.status}
                    onChange={() => markCardAsChanged(groupId)}
                  >
                    <option value="default">Default</option>
                    <option value="not applicable">Not Applicable</option>
                    <option value="not finding">Not Finding</option>
                    <option value="open">Open</option>
                  </select>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Finding Details</h4>
                  <textarea
                    id={`findingDetails-${groupId}`}
                    className="w-full min-h-[100px] p-2 border rounded-md"
                    defaultValue={currentFields.findingDetails}
                    placeholder="Enter finding details..."
                    onChange={() => markCardAsChanged(groupId)}
                  />
                </div>

                <div>
                  <h4 className="font-medium mb-2">Comments</h4>
                  <textarea
                    id={`comments-${groupId}`}
                    className="w-full min-h-[100px] p-2 border rounded-md"
                    defaultValue={currentFields.comments}
                    placeholder="Enter comments..."
                    onChange={() => markCardAsChanged(groupId)}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [groupFields, cardsWithChanges, saveChanges, markCardAsChanged]);

  // Function to render groups based on grouping
  const renderGroups = useCallback(() => {
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
  }, [filteredAndSortedGroups, groupBy, renderGroupCard]);

  // Function to convert to CKL format
  const convertToCkl = (data: ParsedXml) => {
    const benchmark = data.Benchmark;

    const cklData = {
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
              STIG_ID: "",
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
              const status = groupFields[group["@_id"]]?.status || group.status || "default";
              const findingDetails = groupFields[group["@_id"]]?.findingDetails || group.findingDetails || "";
              const comments = groupFields[group["@_id"]]?.comments || group.comments || "";

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
                    ATTRIBUTE_DATA: group.description,
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
  };

  // Function to clear all current data
  const clearCurrentData = () => {
    // Clear state
    setXmlContent(null);
    setParsedXml(null);
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
    localStorage.removeItem("xmlFilters");
    localStorage.removeItem("groupFields");
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Upload XML File</CardTitle>
            <CardDescription>
              Upload an XML or CKL file to view its contents in a structured format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full max-w-sm items-center gap-1.5">
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
                <div className="mt-4 space-y-2">
                  <Button onClick={() => {
                    const cklData = convertToCkl(parsedXml);
                    
                    // Convert the CKL data to XML format
                    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<CHECKLIST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:dsig="http://www.w3.org/2000/09/xmldsig#" xmlns="http://checklists.nist.gov/xccdf/1.1" xsi:schemaLocation="http://checklists.nist.gov/xccdf/1.1 xccdf_checklist.1.1.xsd">
  <ASSET>
    <ROLE>${cklData.CHECKLIST.ASSET.ROLE}</ROLE>
    <ASSET_TYPE>${cklData.CHECKLIST.ASSET.ASSET_TYPE}</ASSET_TYPE>
    <HOST_NAME>${cklData.CHECKLIST.ASSET.HOST_NAME}</HOST_NAME>
    <HOST_IP>${cklData.CHECKLIST.ASSET.HOST_IP}</HOST_IP>
    <HOST_MAC>${cklData.CHECKLIST.ASSET.HOST_MAC}</HOST_MAC>
    <HOST_FQDN>${cklData.CHECKLIST.ASSET.HOST_FQDN}</HOST_FQDN>
    <TECH_AREA>${cklData.CHECKLIST.ASSET.TECH_AREA}</TECH_AREA>
    <TARGET_KEY>${cklData.CHECKLIST.ASSET.TARGET_KEY}</TARGET_KEY>
    <WEB_OR_DATABASE>${cklData.CHECKLIST.ASSET.WEB_OR_DATABASE}</WEB_OR_DATABASE>
    <WEB_DB_SITE>${cklData.CHECKLIST.ASSET.WEB_DB_SITE}</WEB_DB_SITE>
    <WEB_DB_INSTANCE>${cklData.CHECKLIST.ASSET.WEB_DB_INSTANCE}</WEB_DB_INSTANCE>
    <TARGET_COMMENT>${cklData.CHECKLIST.ASSET.TARGET_COMMENT}</TARGET_COMMENT>
  </ASSET>
  <STIGS>
    <iSTIG version="${cklData.CHECKLIST.STIGS.iSTIG['@_version']}">
      <STIG_INFO>
        <VERSION>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.VERSION}</VERSION>
        <CLASSIFICATION>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.CLASSIFICATION}</CLASSIFICATION>
        <STIG_ID>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.STIG_ID}</STIG_ID>
        <TITLE>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.TITLE}</TITLE>
        <DESCRIPTION>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.DESCRIPTION}</DESCRIPTION>
        <FILENAME>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.FILENAME}</FILENAME>
        <RELEASE_INFO>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.RELEASE_INFO}</RELEASE_INFO>
        <SEVERITY>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.SEVERITY}</SEVERITY>
        <STIG_UUID>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.STIG_UUID}</STIG_UUID>
        <NOTICE>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.NOTICE}</NOTICE>
        <SOURCE>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.SOURCE}</SOURCE>
        <STIG_VIEWER_VERSION>${cklData.CHECKLIST.STIGS.iSTIG.STIG_INFO.STIG_VIEWER_VERSION}</STIG_VIEWER_VERSION>
      </STIG_INFO>
      ${cklData.CHECKLIST.STIGS.iSTIG.VULN.map(vuln => `
      <VULN status="${vuln['@_status']}">
        ${vuln.STIG_DATA.map(data => `
        <STIG_DATA>
          <VULN_ATTRIBUTE>${data.VULN_ATTRIBUTE}</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${data.ATTRIBUTE_DATA}</ATTRIBUTE_DATA>
        </STIG_DATA>`).join('')}
        <STATUS>${vuln.STATUS}</STATUS>
        <FINDING_DETAILS>${vuln.FINDING_DETAILS}</FINDING_DETAILS>
        <COMMENTS>${vuln.COMMENTS}</COMMENTS>
        <SEVERITY>${vuln.SEVERITY}</SEVERITY>
        <SEVERITY_OVERRIDE>${vuln.SEVERITY_OVERRIDE}</SEVERITY_OVERRIDE>
        <SEVERITY_JUSTIFICATION>${vuln.SEVERITY_JUSTIFICATION}</SEVERITY_JUSTIFICATION>
      </VULN>`).join('')}
    </iSTIG>
  </STIGS>
</CHECKLIST>`;
                    
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
                  }} className="w-full">
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
          <Card className="w-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Filters & Sorting</CardTitle>
              </div>
            </CardHeader>
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
                
                <div className="space-y-2">
                  <Label htmlFor="severity">Severity Filter</Label>
                  <Select
                    value={severityFilter}
                    onValueChange={(value) => setSeverityFilter(value as Severity | "all")}
                  >
                    <SelectTrigger id="severity">
                      <SelectValue placeholder="Filter by severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status Filter</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="not finding">Not Finding</SelectItem>
                      <SelectItem value="not applicable">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="sort">Sort By</Label>
                  <div className="flex gap-2">
                    <Select
                      value={sortField}
                      onValueChange={(value) => setSortField(value as SortField)}
                    >
                      <SelectTrigger id="sort" className="w-full">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
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
                
                <div className="space-y-2">
                  <Label htmlFor="group">Group By</Label>
                  <Select
                    value={groupBy}
                    onValueChange={(value) => setGroupBy(value as GroupBy)}
                  >
                    <SelectTrigger id="group">
                      <SelectValue placeholder="Group by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Grouping</SelectItem>
                      <SelectItem value="severity">Severity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
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
          <StatisticsCard 
            groups={parsedXml.Benchmark.Group} 
            groupFields={groupFields}
          />

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