// bring in MySql Support
const mysql = require("mysql2/promise");
const EventModel = require('../models/event.model');

class MySqlDatabaseService {
    HOST = process.env.DBHOST ? process.env.DBHOST : "127.0.0.1";
    USER = process.env.DBUSER ? process.env.DBUSER : "dbadmin";
    PASSWORD = process.env.DBPASSWORD ? process.env.DBPASSWORD : "#Mdr90292";
    DATABASE = process.env.DBDATABASE ? process.env.DBDATABASE : "events_db";
    PLACEHOLDER = '?,';
    modelColumns = [];

    constructor() {
        this.connect().then().catch(error => console.log('Connect Error: ', error.message));
        this.modelColumns = Object.keys(new EventModel());
    }
    async connect() {
        this.connection = await mysql.createConnection({
            host: this.HOST,
            user: this.USER,
            password: this.PASSWORD,
            database: this.DATABASE
        });
    }

    /**
     * Gets all events and sorts them in descending order (newest to oldest)
     * @returns {Promise<{events: []}>}
     */
    async getEvents(q = ''){
        const ret = { events: [] };
        const query = q === '' ? 'Select * FROM events order by sortDate DESC' : q;
        try {
            const [results, fields] = await this.connection.execute(query);
            Object.keys(results).forEach((key) => {
                const ev = this.buildEventResponse(results[key]);
                ret.events.push(ev);
            });
        } catch (err) {
            console.log('getEvents - Error: ', err.message);
            throw new Error(`getEvents - Error: ${err.message}`);
        }
        return ret;
    }
    
    buildEventResponse(row) {
        const event = new EventModel();
        Object.keys(row).forEach((key) => {
            event[key] = row[key];
        });
        return event;
    }

    buildEventRow(event) {
        const cols = [];
        const values = [];
        Object.keys(event).forEach((key) => {
            if(this.modelColumns.indexOf(key) !== -1) {
                cols.push(key);
                values.push(event[key]);
            }
        });
        let placeholders = this.PLACEHOLDER.repeat(cols.length);
        placeholders = placeholders.substring(0, placeholders.length-1); // trim off trailing comma
        return {cols, values, placeholders};
    }

    buildUpdateRow(event) {
        const rowObj = this.buildEventRow(event);
        const elements = [];
        for(let i=0; i<rowObj.cols.length; i++) {
            const e = `${rowObj.cols[i]} = '${rowObj.values[i]}'`;
            elements.push(e);
        }
        return elements.join(',');
    }


    /**
     * Add a new event if the date is not specified today's date is used
     * @param event
     * @param returnEvents
     * @returns {Promise<{date}|*|{events: *[]}>}
     */
    async addEvent(event, returnEvents = true){

        event.likes = 0;
        event.dislikes = 0;
        try {
            // console.log('empty date: ', event.eventDate);
            if(!event.eventDate) {
                event.eventDate = this.padDate(new Date().toLocaleString().split(',')[0]);
            } else {
                event.eventDate = this.padDate(event.eventDate);
            }
            event.sortDate = this.createSortDate(event.eventDate);
            const eventRow = this.buildEventRow(event);
            const query = `Insert INTO events (${eventRow.cols.join(',')}) VALUES (${eventRow.placeholders})`;
            const values = eventRow.values;
            const [results, fields] = await this.connection.execute(query, values);
                    if(returnEvents) {
                        try {
                            return await this.getEvents();
                        } catch (e) {
                            throw new Error(`addEvent - getEvents - error: ${e.message}`);
                        }
                    } else {
                        event.id = results.insertId;
                        return event;
                    }
        } catch (e) {
            console.log('addEvent - Error: ', e.message);
            throw new Error(`addEvent - Error: ${e.message}`);
        }
    }

    /**
     * Get an event by its Unique ID
     * @param id
     * @returns Promise<{event: null}|{event: MySql Row}>
     */
    async getEventById(id){
        const query = `SELECT * FROM events where id = '${id}'`;
        try {
            const [results, fields] = await this.connection.execute(query);
            if(results.length > 0) {
                const event = this.buildEventResponse(results[0]);
                return {event};
            } else {
                return {event: null};
            }
        } catch (e) {
            console.log('Error - getEventById: ', e.message);
            throw new Error(`getEventById - Error: ${e.message}`);
        }
    }

    /**
     * Get events by title (could be more than one)
     * @param title
     * @returns {Promise<{events: []}>}
     */
    async getEventsByTitle(title){
        const query = `SELECT * FROM events where title = '${title}'`;
        return await this.getEvents(query);
    }

    /**
     * Updates an event by ID
     * @param id
     * @param event
     * @param returnEvents
     * @returns {Promise<{events: []}>}
     */
    async updateEvent(id, event, returnEvents = true){
        try {
            if(!!event.eventDate) {
                event.eventDate = this.padDate(event.eventDate);
                event.sortDate = this.createSortDate(event.eventDate);
            }
            const updateRow = this.buildUpdateRow(event);
            const query = `UPDATE events SET ${updateRow} WHERE id = ${id}`;
            const [results, fields] = await this.connection.execute(query);
            if(returnEvents) {
                return this.getEvents();
            } else {
                return {events: []};
            }
        } catch (e) {
            console.log('Error - updateEvent: ', e.message);
            throw new Error(`updateEvent - Error: ${e.message}`);
        }
    }

    async deleteEvent(id, returnEvents = true){
        const query = `DELETE FROM events WHERE id = ${id}`;
        try {
            console.log('deleteEvent: ', query);
            const [results, fields] = await this.connection.execute(query);
            if(returnEvents) {
                return this.getEvents();
            } else {
                return {events: []};
            }
        } catch (e) {
            console.log('Error - deleteEvent: ', e.message);
            throw new Error(`deleteEvent - Error: ${e.message}`);
        }
    }

    async getEventsCount(includeNull = true) {
        const query = 'SELECT count(*) as count from events';
        try {
            const [results, fields] = await this.connection.execute(query);
            if(results.length > 0) {
                return {eventCount: results[0].count};
            } else {
                return {eventCount: 0};
            }
        } catch (e) {
            console.log('Error - getEventsCount: ', e.message);
            throw new Error(`getEventsCount - Error: ${e.message}`);
        }
    }

    async deleteLastEntry(){ return null;}

    async changeReaction(id, type, increment=true) {
        if(type === 'likes' || type === 'dislikes') {
            // return the existing object
            const elObj = await this.getEventById(id);
            if(elObj) {
                const el = elObj.event;
                // if you have elements in firestore with no likes property
                if (!el[type]) {
                    el[type] = 0;
                }
                // increment the likes
                if (increment) {
                    el[type]++;
                }
                else {
                    el[type]--;
                }
                // do the update
                await this.updateEvent(id, el);
            }
        } else {
            return this.getEvents();
        }
    }

    async incLikes(id){
        return this.changeReaction(id,'likes')
    }

    async incDisLikes(id){
        return this.changeReaction(id, 'dislikes');
    }

    createSortDate(eventDate){
        const dateParts = eventDate.split('/');
        return `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;
    }

    padDate(date){
        const dateParts = date.split('/');
        return `${dateParts[0].padStart(2, '0')}/${dateParts[1].padStart(2, '0')}/${dateParts[2]}`;
    }
}

module.exports = MySqlDatabaseService;
