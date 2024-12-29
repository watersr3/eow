import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, FlatList, Modal, Button, KeyboardAvoidingView, Platform } from 'react-native';
import Peer from 'peerjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Constants
const USER_KEY = 'userDetails';

// Helper function to handle async storage and peer connections
const saveToStorage = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Error saving data", e);
  }
};

const loadFromStorage = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.error("Error loading data", e);
    return null;
  }
};

// Welcome screen for new users to sign up
const WelcomeScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Event Organizer</Text>
      <Text style={styles.subtitle}>Start organizing your events today!</Text>
      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.button}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
};

// Signup screen for creating new user account
const SignupScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Both fields are required.');
      return;
    }

    setLoading(true);

    const userDetails = { username, password, role: 'Admin', groups: [] }; // Default role is Admin
    await saveToStorage(USER_KEY, userDetails);
    setLoading(false);
    navigation.navigate('Login');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity onPress={handleSignup} disabled={loading}>
        <Text style={[styles.button, { opacity: loading ? 0.5 : 1 }]}>Sign Up</Text>
      </TouchableOpacity>
      {loading && <ActivityIndicator size="large" color="#3498db" />}
    </KeyboardAvoidingView>
  );
};

// Login screen for users to log in
const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const userDetails = await loadFromStorage(USER_KEY);

    if (!userDetails || userDetails.username !== username || userDetails.password !== password) {
      Alert.alert('Error', 'Invalid credentials.');
      setLoading(false);
      return;
    }

    setLoading(false);
    navigation.navigate('Dashboard');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Log In</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity onPress={handleLogin} disabled={loading}>
        <Text style={[styles.button, { opacity: loading ? 0.5 : 1 }]}>Log In</Text>
      </TouchableOpacity>
      {loading && <ActivityIndicator size="large" color="#3498db" />}
    </KeyboardAvoidingView>
  );
};

// Dashboard screen where users can manage groups and events
const DashboardScreen = ({ navigation }) => {
  const [peer, setPeer] = useState(null);
  const [groups, setGroups] = useState([]);
  const [userDetails, setUserDetails] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');

  useEffect(() => {
    const initializePeer = async () => {
      const user = await loadFromStorage(USER_KEY);
      setUserDetails(user);
      const newPeer = new Peer();
      newPeer.on('open', (id) => {
        console.log('Peer opened with ID:', id);
      });
      setPeer(newPeer);

      if (user && user.groups) {
        setGroups(user.groups);
      }
    };

    initializePeer();
  }, []);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Error', 'Group name is required.');
      return;
    }

    const updatedGroups = [...groups, { name: newGroupName, members: [userDetails.username], events: [] }];
    setGroups(updatedGroups);

    // Save updated groups to AsyncStorage
    const updatedUserDetails = { ...userDetails, groups: updatedGroups };
    await saveToStorage(USER_KEY, updatedUserDetails);
    setModalVisible(false);
    setNewGroupName('');
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate.trim() || !newEventDescription.trim()) {
      Alert.alert('Error', 'All event fields are required.');
      return;
    }

    const updatedGroups = groups.map(group => {
      if (group.name === selectedGroup) {
        group.events.push({ title: newEventTitle, date: newEventDate, description: newEventDescription });
      }
      return group;
    });

    setGroups(updatedGroups);

    // Save updated groups to AsyncStorage
    const updatedUserDetails = { ...userDetails, groups: updatedGroups };
    await saveToStorage(USER_KEY, updatedUserDetails);

    // Reset event fields
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventDescription('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello, {userDetails?.username}</Text>
      <Text style={styles.subtitle}>Groups</Text>

      <TouchableOpacity onPress={() => setModalVisible(true)}>
        <Text style={styles.button}>Create New Group</Text>
      </TouchableOpacity>

      <FlatList
        data={groups}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedGroup(item.name)}>
            <Text style={styles.groupItem}>{item.name}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.name}
      />

      <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Create New Group</Text>
          <TextInput
            style={styles.input}
            placeholder="Group Name"
            value={newGroupName}
            onChangeText={setNewGroupName}
          />
          <TouchableOpacity onPress={handleCreateGroup}>
            <Text style={styles.button}>Create</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {selectedGroup && (
        <View style={styles.eventSection}>
          <Text style={styles.subtitle}>Create Event for {selectedGroup}</Text>
          <TextInput
            style={styles.input}
            placeholder="Event Title"
            value={newEventTitle}
            onChangeText={setNewEventTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Event Date"
            value={newEventDate}
            onChangeText={setNewEventDate}
          />
          <TextInput
            style={styles.input}
            placeholder="Event Description"
            value={newEventDescription}
            onChangeText={setNewEventDescription}
          />
          <TouchableOpacity onPress={handleCreateEvent}>
            <Text style={styles.button}>Create Event</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f4f4f9',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  input: {
    width: '80%',
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  button: {
    fontSize: 18,
    color: '#3498db',
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#ecf0f1',
    borderRadius: 5,
    marginBottom: 10,
  },
  groupItem: {
    padding: 15,
    backgroundColor: '#ecf0f1',
    borderRadius: 5,
    marginBottom: 10,
    width: '100%',
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalTitle: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 20,
  },
  eventSection: {
    marginTop: 20,
  },
});

