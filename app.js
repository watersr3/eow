import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as SQLite from 'expo-sqlite';
import Peer from 'peerjs';

const App = () => {
  const [groups, setGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [conn, setConn] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize PeerJS
    const newPeer = new Peer();
    newPeer.on('open', id => {
      setPeer(newPeer);
      setPeerId(id);
      console.log('My peer ID is:', id);
    });

    newPeer.on('connection', (connection) => {
      setConn(connection);
      connection.on('data', handleRemoteData); // handle received data
    });

    const initializeDatabase = async () => {
      const db = await SQLite.openDatabaseAsync('events.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          createdAt TEXT
        );
      `);

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS group_members (
          groupId INTEGER,
          userId INTEGER,
          role TEXT,  // 'admin' or 'member'
          PRIMARY KEY (groupId, userId),
          FOREIGN KEY (groupId) REFERENCES groups(id)
        );
      `);

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          groupId INTEGER,
          title TEXT,
          date TEXT,
          location TEXT,
          description TEXT,
          createdAt TEXT,
          FOREIGN KEY (groupId) REFERENCES groups(id)
        );
      `);
      await db.closeAsync();
    };

    initializeDatabase();
    getGroups();

    return () => {
      if (newPeer) newPeer.destroy(); // Clean up on unmount
    };
  }, []);

  const getGroups = async () => {
    setLoading(true);
    const db = await SQLite.openDatabaseAsync('events.db');
    const result = await db.getAllAsync('SELECT * FROM groups');
    setGroups(result);
    await db.closeAsync();
    setLoading(false);
  };

  const getEvents = async (groupId) => {
    setLoading(true);
    const db = await SQLite.openDatabaseAsync('events.db');
    const result = await db.getAllAsync('SELECT * FROM events WHERE groupId = ?;', [groupId]);
    setEvents(result);
    await db.closeAsync();
    setLoading(false);
  };

  const createGroup = async () => {
    if (groupName) {
      const db = await SQLite.openDatabaseAsync('events.db');
      const createdAt = new Date().toISOString();
      const result = await db.runAsync('INSERT INTO groups (name, createdAt) VALUES (?, ?);', [groupName, createdAt]);
      console.log('Group created:', result);
      getGroups();
      setGroupName('');
      await db.closeAsync();
    } else {
      alert('Please enter a group name');
    }
  };

  const addEvent = async () => {
    if (title && date && location && description && selectedGroupId) {
      const db = await SQLite.openDatabaseAsync('events.db');
      const createdAt = new Date().toISOString();
      const result = await db.runAsync(
        'INSERT INTO events (groupId, title, date, location, description, createdAt) VALUES (?, ?, ?, ?, ?, ?);',
        [selectedGroupId, title, date, location, description, createdAt]
      );
      console.log('Event added:', result);
      setTitle('');
      setDate('');
      setLocation('');
      setDescription('');
      getEvents(selectedGroupId);
      broadcastEventUpdate('add', { groupId: selectedGroupId, title, date, location, description });
      await db.closeAsync();
    } else {
      alert('Please fill in all fields and select a group');
    }
  };

  const broadcastEventUpdate = (action, payload) => {
    if (conn) {
      conn.send({ action, payload });
    } else {
      alert('No connection to peer.');
    }
  };

  const connectToPeer = () => {
    if (remotePeerId) {
      const connection = peer.connect(remotePeerId);
      connection.on('open', () => {
        setConn(connection);
      });
      connection.on('data', handleRemoteData);
    } else {
      alert('Please enter a peer ID to connect to.');
    }
  };

  const handleRemoteData = (data) => {
    if (data.action === 'add') {
      const { groupId, title, date, location, description } = data.payload;
      addEventToLocalDb(groupId, title, date, location, description);
    }
  };

  const addEventToLocalDb = async (groupId, title, date, location, description) => {
    const db = await SQLite.openDatabaseAsync('events.db');
    await db.runAsync(
      'INSERT INTO events (groupId, title, date, location, description) VALUES (?, ?, ?, ?, ?);',
      [groupId, title, date, location, description]
    );
    getEvents(groupId);
    await db.closeAsync();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Event Organizer</Text>
      {/* Group Management */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Group Name"
          value={groupName}
          onChangeText={setGroupName}
        />
        <TouchableOpacity style={styles.button} onPress={createGroup}>
          <Text style={styles.buttonText}>Create Group</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subHeader}>Select Group:</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#007bff" />
      ) : (
        <FlatList
          data={groups}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.groupButton}
              onPress={() => {
                setSelectedGroupId(item.id);
                getEvents(item.id);
              }}
            >
              <Text style={styles.groupButtonText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id.toString()}
        />
      )}

      <Text style={styles.subHeader}>Add Event:</Text>
      <TextInput
        style={styles.input}
        placeholder="Event Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Event Date"
        value={date}
        onChangeText={setDate}
      />
      <TextInput
        style={styles.input}
        placeholder="Event Location"
        value={location}
        onChangeText={setLocation}
      />
      <TextInput
        style={styles.input}
        placeholder="Event Description"
        value={description}
        onChangeText={setDescription}
      />
      <TouchableOpacity style={styles.button} onPress={addEvent}>
        <Text style={styles.buttonText}>Add Event</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Enter Peer ID"
        value={remotePeerId}
        onChangeText={setRemotePeerId}
      />
      <TouchableOpacity style={styles.button} onPress={connectToPeer}>
        <Text style={styles.buttonText}>Connect to Peer</Text>
      </TouchableOpacity>

      <FlatList
        data={events}
        renderItem={({ item }) => (
          <View style={styles.eventItem}>
            <Text style={styles.eventText}>{item.title}</Text>
            <Text style={styles.eventText}>Date: {item.date}</Text>
            <Text style={styles.eventText}>Location: {item.location}</Text>
            <Text style={styles.eventText}>Description: {item.description}</Text>
          </View>
        )}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
  },
  header: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#007bff',
  },
  subHeader: {
    fontSize: 20,
    fontWeight: '600',
    marginVertical: 10,
    color: '#333333',
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    height: 40,
    borderColor: '#007bff',
    borderWidth: 1,
    borderRadius: 5,
    paddingLeft: 10,
    marginBottom: 10,
    fontSize: 16,
    color: '#333333',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  groupButton: {
    backgroundColor: '#f1f1f1',
    padding: 15,
    borderRadius: 5,
    marginVertical: 5,
  },
  groupButtonText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#007bff',
  },
  eventItem: {
    backgroundColor: '#e9ecef',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
  },
  eventText: {
    fontSize: 16,
    color: '#333333',
  },
});

export default App;
