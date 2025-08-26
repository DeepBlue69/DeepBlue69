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
import { CalendarIcon, Plus, Trash2, FileText, Users, BarChart3, LogOut, Eye, Printer } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '', role: 'data_entry' });
  const [challans, setChallans] = useState([]);
  const [newChallan, setNewChallan] = useState({ items: [{ name: '', quantity: '', unit: 'bags' }] });
  const [reports, setReports] = useState(null);
  const [reportQuery, setReportQuery] = useState({ report_type: 'daily', start_date: null, end_date: null });
  const [users, setUsers] = useState([]);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [activeTab, setActiveTab] = useState('challans');
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (token) {
      getCurrentUser();
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      fetchChallans();
      if (user.role === 'admin') {
        fetchUsers();
      }
    }
  }, [user]);

  const getCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error getting current user:', error);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
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

  const printChallan = (challan) => {
    const printWindow = window.open('', '_blank');
    const challanDate = new Date(challan.created_at).toLocaleDateString('hi-IN');
    const challanTime = new Date(challan.created_at).toLocaleTimeString('hi-IN');
    
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
            .items-table { width: 100%; border-collapse: collapse; }
            .items-table th, .items-table td { border: 1px solid #000; padding: 8px; text-align: left; }
            .items-table th { background-color: #f0f0f0; font-weight: bold; }
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
              <strong>दिनांक / Date:</strong> ${challanDate}<br>
              <strong>समय / Time:</strong> ${challanTime}
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
          <TabsList className="grid w-full grid-cols-4 bg-white/90 backdrop-blur-sm border border-orange-200">
            <TabsTrigger value="challans" className="data-[state=active]:bg-orange-100">
              <FileText className="w-4 h-4 mr-2" />
              चालान
            </TabsTrigger>
            <TabsTrigger value="create" className="data-[state=active]:bg-orange-100">
              <Plus className="w-4 h-4 mr-2" />
              नया चालान
            </TabsTrigger>
            {(user?.role === 'admin' || user?.role === 'supervisor') && (
              <TabsTrigger value="reports" className="data-[state=active]:bg-orange-100">
                <BarChart3 className="w-4 h-4 mr-2" />
                रिपोर्ट
              </TabsTrigger>
            )}
            {user?.role === 'admin' && (
              <TabsTrigger value="users" className="data-[state=active]:bg-orange-100">
                <Users className="w-4 h-4 mr-2" />
                उपयोगकर्ता
              </TabsTrigger>
            )}
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
                                {new Date(challan.created_at).toLocaleDateString('hi-IN')}
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
                                        <p><strong>दिनांक:</strong> {new Date(selectedChallan.created_at).toLocaleDateString('hi-IN')}</p>
                                        <p><strong>समय:</strong> {new Date(selectedChallan.created_at).toLocaleTimeString('hi-IN')}</p>
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
                            {(user.role === 'admin' || user.role === 'supervisor') && (
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
          {(user?.role === 'admin' || user?.role === 'supervisor') && (
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
                          कुल चालान: {reports.total_challans}
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
          )}

          {/* Users Tab */}
          {user?.role === 'admin' && (
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? "default" : "destructive"}>
                              {user.is_active ? "सक्रिय" : "निष्क्रिय"}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(user.created_at).toLocaleDateString('hi-IN')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
      <Toaster />
    </div>
  );
}

export default App;