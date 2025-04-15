"use client";

import { useState, useEffect, useRef } from "react";
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

  // // Function to update group fields
  // const updateGroupField = (groupId: string, field: 'status' | 'findingDetails' | 'comments', value: string) => {
  //   setGroupFields(prev => ({
  //     ...prev,
  //     [groupId]: {
  //       ...prev[groupId],
  //       [field]: value
  //     }
  //   }));
  // };

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

  // Function to filter and sort groups
  const getFilteredAndSortedGroups = () => {
    if (!parsedXml?.Benchmark?.Group) return [];
    
    let filteredGroups = [...parsedXml.Benchmark.Group];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredGroups = filteredGroups.filter(group => 
        group.title.toLowerCase().includes(term) || 
        group.Rule.title.toLowerCase().includes(term) ||
        (typeof group.Rule.description === 'string' && 
         group.Rule.description.toLowerCase().includes(term))
      );
      console.log(`Filtered by search term "${searchTerm}": ${filteredGroups.length} results`);
    }
    
    // Apply severity filter
    if (severityFilter !== "all") {
      filteredGroups = filteredGroups.filter(group => 
        group.Rule["@_severity"] === severityFilter
      );
      console.log(`Filtered by severity "${severityFilter}": ${filteredGroups.length} results`);
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filteredGroups = filteredGroups.filter(group => {
        const groupId = group["@_id"];
        // Use status from the group object if available, otherwise use from groupFields
        const status = group.status || groupFields[groupId]?.status;
        
        if (statusFilter === "default") {
          // Show items that don't have a status set yet
          return !status;
        } else {
          // Show items with the selected status
          return status === statusFilter;
        }
      });
      console.log(`Filtered by status "${statusFilter}": ${filteredGroups.length} results`);
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
    
    console.log(`Sorted by ${sortField} in ${sortOrder} order`);
    return filteredGroups;
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

  // Function to render groups based on grouping
  const renderGroups = () => {
    const filteredGroups = getFilteredAndSortedGroups();
    
    if (groupBy === "none") {
      return filteredGroups.map((group) => renderGroupCard(group));
    }
    
    // Group by severity
    const groupedBySeverity: Record<string, Group[]> = {};
    
    filteredGroups.forEach(group => {
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

  // Function to render a single group card
  const renderGroupCard = (group: Group) => {
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
  };

  // Function to convert to CKL format
  const convertToCKL = () => {
    if (!parsedXml) return;

    const benchmark = parsedXml.Benchmark;
    const groups = benchmark.Group;

    // Create CKL XML structure
    const cklXml = `<?xml version="1.0" encoding="UTF-8"?>
<CHECKLIST>
  <ASSET>
    <ROLE>None</ROLE>
    <ASSET_TYPE>Computing</ASSET_TYPE>
    <MARKING>UNCLASSIFIED</MARKING>
    <HOST_NAME>${benchmark.title}</HOST_NAME>
    <HOST_IP>Unknown</HOST_IP>
    <HOST_MAC>Unknown</HOST_MAC>
    <HOST_FQDN>Unknown</HOST_FQDN>
    <TARGET_COMMENT>${benchmark.description}</TARGET_COMMENT>
  </ASSET>
  <STIGS>
    <iSTIG>
      <STIG_INFO>
        <VERSION>${benchmark["plain-text"]["#text"]}</VERSION>
        <TITLE>${benchmark.title}</TITLE>
        <RELEASE_INFO>${benchmark.status["#text"]}</RELEASE_INFO>
        <SOURCE>${benchmark.reference["#text"]}</SOURCE>
      </STIG_INFO>
      ${groups.map(group => {
        const groupId = group["@_id"];
        const fields = groupFields[groupId] || {
          status: "default",
          findingDetails: "",
          comments: ""
        };
        
        return `
      <VULN>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Vuln_Num</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${group["@_id"]}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Severity</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${group.Rule["@_severity"]?.toUpperCase() || "UNKNOWN"}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Group_Title</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${group.title}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Rule_ID</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${group.Rule["@_id"]}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Rule_Ver</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${group.Rule.version}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Rule_Title</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${group.Rule.title}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Vuln_Discuss</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${renderDescription(group.Rule.description)?.VulnDiscussion || "No discussion available"}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Check_Content</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${group.Rule.check["check-content"] || "No check content available"}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STIG_DATA>
          <VULN_ATTRIBUTE>Fix_Text</VULN_ATTRIBUTE>
          <ATTRIBUTE_DATA>${group.Rule.fixtext["#text"] || "No fix text available"}</ATTRIBUTE_DATA>
        </STIG_DATA>
        <STATUS>${fields.status.toUpperCase()}</STATUS>
        <FINDING_DETAILS>${fields.findingDetails}</FINDING_DETAILS>
        <COMMENTS>${fields.comments}</COMMENTS>
      </VULN>`;
      }).join('')}
    </iSTIG>
  </STIGS>
</CHECKLIST>`;

    // Create and trigger download
    const blob = new Blob([cklXml], { type: 'text/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${benchmark.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ckl`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
                  <Button onClick={convertToCKL} className="w-full">
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
                <h3 className="text-lg font-medium">Results ({getFilteredAndSortedGroups().length} of {parsedXml.Benchmark.Group.length})</h3>
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