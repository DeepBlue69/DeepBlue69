import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Calendar } from './components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import { Checkbox } from './components/ui/checkbox';
import { CalendarIcon, Plus, Trash2, FileText, Users, BarChart3, LogOut, Eye, Printer, Settings, Shield } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '', role: 'data_entry' });
  const [challans, setChallans] = useState([]);
  const [newChallan, setNewChallan] = useState({ items: [{ name: '', quantity: '', unit: 'bags' }] });
  const [reports, setReports] = useState(null);
  const [reportQuery, setReportQuery] = useState({ report_type: 'daily', start_date: null, end_date: null });
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [activeTab, setActiveTab] = useState('challans');
  const [showRegister, setShowRegister] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);

  useEffect(() => {
    if (token) {
      getCurrentUser();
    }
  }, [token]);

  useEffect(() => {
    if (user && user.permissions) {
      fetchChallans();
      if (user.permissions.includes('manage_users')) {
        fetchUsers();
      }
      if (user.permissions.includes('manage_permissions')) {
        fetchAvailablePermissions();
      }
    }
  }, [user]);

  const getCurrentUser = async () => {
    try {
      setUserLoading(true);
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = response.data;
      
      // Ensure permissions is always an array
      if (!userData.permissions) {
        userData.permissions = [];
      }
      
      setUser(userData);
    } catch (error) {
      console.error('Error getting current user:', error);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setUserLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/auth/login`, loginData);
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      toast.success('लॉगिन सफल!');
      setLoginData({ username: '', password: '' });
    } catch (error) {
      toast.error('लॉगिन में त्रुटि: ' + (error.response?.data?.detail || 'अज्ञात त्रुटि'));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/auth/register`, registerData);
      toast.success('पंजीकरण सफल! कृपया लॉगिन करें।');
      setRegisterData({ username: '', email: '', password: '', role: 'data_entry' });
      setShowRegister(false);
    } catch (error) {
      toast.error('पंजीकरण में त्रुटि: ' + (error.response?.data?.detail || 'अज्ञात त्रुटि'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setUserLoading(false);
    setChallans([]);
    setReports(null);
    setUsers([]);
    toast.success('लॉगआउट सफल!');
  };

  const fetchChallans = async () => {
    try {
      const response = await axios.get(`${API}/challans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChallans(response.data);
    } catch (error) {
      toast.error('चालान लाने में त्रुटि');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('उपयोगकर्ता लाने में त्रुटि');
    }
  };

  const fetchAvailablePermissions = async () => {
    try {
      const response = await axios.get(`${API}/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissions(response.data.permissions);
    } catch (error) {
      toast.error('अनुमतियां लाने में त्रुटि');
    }
  };

  const createChallan = async (e) => {
    e.preventDefault();
    try {
      const challanData = {
        items: newChallan.items.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity)
        }))
      };
      
      await axios.post(`${API}/challans`, challanData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('चालान बनाया गया!');
      setNewChallan({ items: [{ name: '', quantity: '', unit: 'bags' }] });
      fetchChallans();
    } catch (error) {
      toast.error('चालान बनाने में त्रुटि');
    }
  };

  const generateReport = async () => {
    try {
      const response = await axios.post(`${API}/reports`, reportQuery, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReports(response.data);
      toast.success('रिपोर्ट तैयार!');
    } catch (error) {
      toast.error('रिपोर्ट तैयार करने में त्रुटि');
    }
  };

  const deleteChallan = async (challanId) => {
    try {
      await axios.delete(`${API}/challans/${challanId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('चालान हटाया गया!');
      fetchChallans();
    } catch (error) {
      toast.error('चालान हटाने में त्रुटि');
    }
  };

  const updateUserPermissions = async () => {
    try {
      await axios.put(`${API}/users/${selectedUser.id}/permissions`, 
        { user_id: selectedUser.id, permissions: userPermissions },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('उपयोगकर्ता अनुमतियां अपडेट की गईं!');
      setPermissionDialogOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error('अनुमतियां अपडेट करने में त्रुटि');
    }
  };

  const openPermissionDialog = (user) => {
    setSelectedUser(user);
    setUserPermissions(user.permissions || []);
    setPermissionDialogOpen(true);
  };

  const addItem = () => {
    setNewChallan({
      ...newChallan,
      items: [...newChallan.items, { name: '', quantity: '', unit: 'bags' }]
    });
  };

  const removeItem = (index) => {
    const items = newChallan.items.filter((_, i) => i !== index);
    setNewChallan({ ...newChallan, items });
  };

  const updateItem = (index, field, value) => {
    const items = [...newChallan.items];
    items[index][field] = value;
    setNewChallan({ ...newChallan, items });
  };

  const formatDateTimeIST = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('hi-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const printChallan = (challan) => {
    const printWindow = window.open('', '_blank');
    const challanDateTime = formatDateTimeIST(challan.created_at);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>डिलिवरी चालान - ${challan.challan_number}</title>
          <style>
            @page { size: A4 landscape; margin: 1cm; }
            body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; font-size: 14px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .challan-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #000; padding: 8px; text-align: left; }
            .items-table th { background-color: #f0f0f0; font-weight: bold; }
            .totals-section { background-color: #f9f9f9; padding: 10px; border: 2px solid #000; margin-bottom: 20px; }
            .totals-table { width: 100%; }
            .totals-table td { padding: 5px 10px; font-weight: bold; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; }
            .signature-box { border-top: 1px solid #000; padding-top: 5px; width: 200px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>डिलिवरी चालान</h1>
            <h2>DELIVERY CHALLAN</h2>
          </div>
          
          <div class="challan-info">
            <div>
              <strong>चालान संख्या / Challan No:</strong> ${challan.challan_number}<br>
              <strong>दिनांक व समय / Date & Time:</strong> ${challanDateTime}
            </div>
            <div>
              <strong>द्वारा बनाया गया / Created By:</strong> ${challan.created_by}
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>क्र.सं. / S.No.</th>
                <th>वस्तु का नाम / Item Name</th>
                <th>मात्रा / Quantity</th>
                <th>इकाई / Unit</th>
              </tr>
            </thead>
            <tbody>
              ${challan.items_hindi?.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>
          
          <div class="totals-section">
            <h3 style="margin: 0 0 10px 0; text-align: center;">कुल मात्रा / Total Quantities</h3>
            <table class="totals-table">
              <tr>
                <td>कुल बैग / Total Bags:</td>
                <td>${challan.totals?.total_bags || 0}</td>
                <td>कुल किलोग्राम / Total Kgs:</td>
                <td>${challan.totals?.total_kgs || 0}</td>
              </tr>
            </table>
          </div>
          
          <div class="footer">
            <div class="signature-box">
              <div>प्राप्तकर्ता का हस्ताक्षर</div>
              <div>Receiver's Signature</div>
            </div>
            <div class="signature-box">
              <div>वितरणकर्ता का हस्ताक्षर</div>
              <div>Dispatcher's Signature</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold text-orange-800">डिलिवरी चालान जेनरेटर</CardTitle>
            <CardDescription className="text-orange-600">Delivery Challan Generator</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={showRegister ? 'register' : 'login'} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" onClick={() => setShowRegister(false)}>लॉगिन</TabsTrigger>
                <TabsTrigger value="register" onClick={() => setShowRegister(true)}>पंजीकरण</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="username">उपयोगकर्ता नाम</Label>
                    <Input
                      id="username"
                      placeholder="Username"
                      value={loginData.username}
                      onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">पासवर्ड</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">
                    लॉगिन करें
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="reg-username">उपयोगकर्ता नाम</Label>
                    <Input
                      id="reg-username"
                      placeholder="Username"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">ईमेल</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-password">पासवर्ड</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="Password"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">भूमिका</Label>
                    <Select value={registerData.role} onValueChange={(value) => setRegisterData({...registerData, role: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="data_entry">डेटा एंट्री</SelectItem>
                        <SelectItem value="supervisor">सुपरवाइज़र</SelectItem>
                        <SelectItem value="admin">एडमिन</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">
                    पंजीकरण करें
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    );
  }

  // Loading state while user data is being fetched
  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-orange-800">लोड हो रहा है...</p>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    );
  }

  const tabsToShow = [
    { key: 'challans', label: 'चालान', icon: FileText, permission: ['view_all_challans', 'view_own_challans'] },
    { key: 'create', label: 'नया चालान', icon: Plus, permission: ['create_challan'] },
    { key: 'reports', label: 'रिपोर्ट', icon: BarChart3, permission: ['view_reports'] },
    { key: 'users', label: 'उपयोगकर्ता', icon: Users, permission: ['manage_users'] },
    { key: 'permissions', label: 'अनुमतियां', icon: Shield, permission: ['manage_permissions'] }
  ].filter(tab => {
    if (!user || !user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }
    return tab.permission.some(perm => user.permissions.includes(perm));
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-orange-200">
          <div>
            <h1 className="text-2xl font-bold text-orange-800">डिलिवरी चालान जेनरेटर</h1>
            <p className="text-orange-600">स्वागत है, {user?.username} ({user?.role})</p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-orange-300 hover:bg-orange-100">
            <LogOut className="w-4 h-4 mr-2" />
            लॉगआउट
          </Button>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full bg-white/90 backdrop-blur-sm border border-orange-200" style={{gridTemplateColumns: `repeat(${tabsToShow.length}, 1fr)`}}>
            {tabsToShow.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className="data-[state=active]:bg-orange-100">
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Challans Tab */}
          <TabsContent value="challans">
            <Card className="bg-white/90 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-800">सभी चालान</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {challans.map((challan) => (
                    <Card key={challan.id} className="border-orange-100 hover:border-orange-300 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                चालान #{challan.challan_number}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                {formatDateTimeIST(challan.created_at)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">आइटम: {challan.items.length}</p>
                              <div className="text-sm text-gray-600 mt-1">
                                {challan.items.map((item, index) => (
                                  <span key={index}>
                                    {item.name} ({item.quantity} {item.unit})
                                    {index < challan.items.length - 1 && ', '}
                                  </span>
                                ))}
                              </div>
                              <div className="text-sm font-medium text-orange-700 mt-2">
                                कुल: {challan.totals?.total_bags || 0} बैग, {challan.totals?.total_kgs || 0} किग्रा
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedChallan(challan)}
                                  className="border-orange-300 hover:bg-orange-50"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>चालान #{selectedChallan?.challan_number}</DialogTitle>
                                </DialogHeader>
                                {selectedChallan && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <p><strong>दिनांक व समय:</strong> {formatDateTimeIST(selectedChallan.created_at)}</p>
                                      </div>
                                      <div>
                                        <p><strong>बनाने वाला:</strong> {selectedChallan.created_by}</p>
                                      </div>
                                    </div>
                                    <Separator />
                                    <div>
                                      <h4 className="font-medium mb-2">आइटम (हिंदी में):</h4>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>नाम</TableHead>
                                            <TableHead>मात्रा</TableHead>
                                            <TableHead>इकाई</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {selectedChallan.items_hindi?.map((item, index) => (
                                            <TableRow key={index}>
                                              <TableCell>{item.name}</TableCell>
                                              <TableCell>{item.quantity}</TableCell>
                                              <TableCell>{item.unit}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-lg">
                                      <h4 className="font-medium mb-2">कुल मात्रा:</h4>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <span className="font-semibold">कुल बैग:</span> {selectedChallan.totals?.total_bags || 0}
                                        </div>
                                        <div>
                                          <span className="font-semibold">कुल किग्रा:</span> {selectedChallan.totals?.total_kgs || 0}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                      <Button
                                        onClick={() => printChallan(selectedChallan)}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        <Printer className="w-4 h-4 mr-2" />
                                        प्रिंट करें
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button
                              onClick={() => printChallan(challan)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            {user && user.permissions && user.permissions.includes('delete_challan') && (
                              <Button
                                onClick={() => deleteChallan(challan.id)}
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create Challan Tab */}
          <TabsContent value="create">
            <Card className="bg-white/90 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-800">नया चालान बनाएं</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createChallan} className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">आइटम जोड़ें</h3>
                      <Button type="button" onClick={addItem} variant="outline" className="border-orange-300">
                        <Plus className="w-4 h-4 mr-2" />
                        आइटम जोड़ें
                      </Button>
                    </div>
                    
                    {newChallan.items.map((item, index) => (
                      <Card key={index} className="border-orange-100">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-2">
                              <Label>आइटम का नाम</Label>
                              <Input
                                placeholder="e.g., Rice, Wheat"
                                value={item.name}
                                onChange={(e) => updateItem(index, 'name', e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <Label>मात्रा</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                required
                              />
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label>इकाई</Label>
                                <Select value={item.unit} onValueChange={(value) => updateItem(index, 'unit', value)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="bags">Bags</SelectItem>
                                    <SelectItem value="kgs">Kgs</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {newChallan.items.length > 1 && (
                                <Button
                                  type="button"
                                  onClick={() => removeItem(index)}
                                  variant="destructive"
                                  size="sm"
                                  className="mt-6"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <Button type="submit" className="w-full md:w-auto bg-orange-600 hover:bg-orange-700">
                    चालान बनाएं
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card className="bg-white/90 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-800">रिपोर्ट</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>रिपोर्ट प्रकार</Label>
                    <Select value={reportQuery.report_type} onValueChange={(value) => setReportQuery({...reportQuery, report_type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">दैनिक</SelectItem>
                        <SelectItem value="weekly">साप्ताहिक</SelectItem>
                        <SelectItem value="monthly">मासिक</SelectItem>
                        <SelectItem value="yearly">वार्षिक</SelectItem>
                        <SelectItem value="custom">कस्टम</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {reportQuery.report_type === 'custom' && (
                    <>
                      <div>
                        <Label>शुरुआती तारीख</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {reportQuery.start_date ? format(reportQuery.start_date, "dd/MM/yyyy") : "तारीख चुनें"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={reportQuery.start_date}
                              onSelect={(date) => setReportQuery({...reportQuery, start_date: date})}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label>अंतिम तारीख</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {reportQuery.end_date ? format(reportQuery.end_date, "dd/MM/yyyy") : "तारीख चुनें"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={reportQuery.end_date}
                              onSelect={(date) => setReportQuery({...reportQuery, end_date: date})}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </>
                  )}
                </div>
                
                <Button onClick={generateReport} className="bg-orange-600 hover:bg-orange-700">
                  रिपोर्ट तैयार करें
                </Button>
                
                {reports && (
                  <Card className="border-orange-100">
                    <CardHeader>
                      <CardTitle className="text-lg">रिपोर्ट परिणाम</CardTitle>
                      <CardDescription>
                        कुल चालान: {reports.total_challans} | कुल बैग: {reports.total_bags_all} | कुल किग्रा: {reports.total_kgs_all}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">आइटम कुल मात्रा:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(reports.item_totals).map(([item, total]) => (
                              <div key={item} className="flex justify-between bg-orange-50 p-2 rounded">
                                <span>{item}</span>
                                <span className="font-medium">{total}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="bg-white/90 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-800">उपयोगकर्ता प्रबंधन</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>नाम</TableHead>
                      <TableHead>ईमेल</TableHead>
                      <TableHead>भूमिका</TableHead>
                      <TableHead>स्थिति</TableHead>
                      <TableHead>बनाने की तारीख</TableHead>
                      {user && user.permissions && user.permissions.includes('manage_permissions') && <TableHead>अनुमतियां</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userData) => (
                      <TableRow key={userData.id}>
                        <TableCell>{userData.username}</TableCell>
                        <TableCell>{userData.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            {userData.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={userData.is_active ? "default" : "destructive"}>
                            {userData.is_active ? "सक्रिय" : "निष्क्रिय"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDateTimeIST(userData.created_at)}</TableCell>
                        {user && user.permissions && user.permissions.includes('manage_permissions') && (
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPermissionDialog(userData)}
                              className="border-orange-300 hover:bg-orange-50"
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              प्रबंधित करें
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions Management Tab */}
          <TabsContent value="permissions">
            <Card className="bg-white/90 backdrop-blur-sm border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-800">अनुमति प्रबंधन</CardTitle>
                <CardDescription>उपयोगकर्ताओं की अनुमतियां प्रबंधित करें</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">उपलब्ध अनुमतियां:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(permissions).map(([key, description]) => (
                      <Card key={key} className="border-gray-200">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Shield className="w-4 h-4 text-orange-600" />
                            <div>
                              <p className="font-medium">{key}</p>
                              <p className="text-sm text-gray-600">{description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Permission Management Dialog */}
        <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>अनुमतियां प्रबंधित करें - {selectedUser?.username}</DialogTitle>
              <DialogDescription>
                इस उपयोगकर्ता के लिए अनुमतियां चुनें
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {Object.entries(permissions).map(([key, description]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={userPermissions.includes(key)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setUserPermissions([...userPermissions, key]);
                      } else {
                        setUserPermissions(userPermissions.filter(p => p !== key));
                      }
                    }}
                  />
                  <Label htmlFor={key} className="text-sm">
                    <div>
                      <p className="font-medium">{key}</p>
                      <p className="text-gray-600">{description}</p>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setPermissionDialogOpen(false)}>
                रद्द करें
              </Button>
              <Button onClick={updateUserPermissions} className="bg-orange-600 hover:bg-orange-700">
                अपडेट करें
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Toaster />
    </div>
  );
}

export default App;