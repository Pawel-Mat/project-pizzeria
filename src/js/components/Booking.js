import {templates, select, settings, classNames} from '../settings.js';
import AmountWidget from './AmountWidget.js';
import DatePicker from './DatePicker.js';
import HourPicker from './HourPicker.js';
import utils from '../utils.js';

export default class Booking{
  constructor(element){
    const thisBooking = this;

    thisBooking.render(element);
    thisBooking.initWidgets();
    thisBooking.getData();
    thisBooking.chooseTable();
  }

  getData(){
    const thisBooking = this;
    const startDateParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePicker.minDate);
    const endDateParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePicker.maxDate);


    const params = {
      booking: [
        startDateParam,
        endDateParam,
      ],
      eventsCurrent: [
        settings.db.notRepeatParam,
        startDateParam,
        endDateParam,
      ],
      eventsRepeat: [
        settings.db.repeatParam,
        endDateParam,
      ],
    };

    const urls = {
      booking:       settings.db.url + '/' + settings.db.booking 
                                     + '?' + params.booking.join('&'),
      eventsCurrent: settings.db.url + '/' + settings.db.event   
                                     + '?' + params.eventsCurrent.join('&'),
      eventsRepeat:  settings.db.url + '/' + settings.db.event   
                                     + '?' + params.eventsRepeat.join('&'),
    };

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),
    ])
      .then(function(allResponses){
        const bookingsResponse = allResponses[0];
        const eventsCurrentResponse = allResponses[1];
        const eventsRepeatResponse = allResponses[2];
        return Promise.all([
          bookingsResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json(),
        ]);
      })
      .then(function([bookings, eventsCurrent, eventsRepeat]){
        console.log(bookings);
        console.log(eventsCurrent);
        console.log(eventsRepeat);
        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat){
    const thisBooking = this;
    
    thisBooking.booked = {};

    for(let item of bookings){
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    for(let item of eventsCurrent){
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    const minDate = thisBooking.datePicker.minDate;
    const maxDate = thisBooking.datePicker.maxDate;

    for(let item of eventsRepeat){
      if(item.repeat == 'daily'){
        for(let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)){
          thisBooking.makeBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
        }
      }
    }

    // console.log('thisBooking.booked',thisBooking.booked);
    thisBooking.updateDOM();
    thisBooking.rangeSlider();
  }

  makeBooked(date, hour, duration, table){
    const thisBooking = this;

    if(typeof thisBooking.booked[date] == 'undefined'){
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);
    for(let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5){

      if(typeof thisBooking.booked[date][hourBlock] == 'undefined'){
        thisBooking.booked[date][hourBlock] = [];
      }

      thisBooking.booked[date][hourBlock].push(parseInt(table));
    }
  }

  updateDOM(){
    const thisBooking = this;

    thisBooking.date = thisBooking.datePicker.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

    let allAvailable = false;

    if(
      typeof thisBooking.booked[thisBooking.date] == 'undefined'
      ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
    ){
      allAvailable = true;
    }

    for(let table of thisBooking.dom.tables){
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);
      if(!isNaN(tableId)){
        tableId = parseInt(tableId);
      }

      if(
        !allAvailable
        &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)
      ){
        table.classList.add(classNames.booking.tableBooked);
      } else {
        table.classList.remove(classNames.booking.tableBooked);
      }
    }

    thisBooking.rangeSlider();
  }
  chooseTable(){
    const thisBooking = this;

    for(let table of thisBooking.dom.tables){
      table.addEventListener('click', function(){
        if(table.classList.contains(classNames.booking.tableBooked)){
          return;
        } else {
          const tableId = table.getAttribute(settings.booking.tableIdAttribute);
          console.log('tableID', tableId);
          thisBooking.selectedTable = tableId;
          for(let table of thisBooking.dom.tables){
            table.classList.remove(classNames.booking.choosedTable);
          }
          if (!table.classList.contains(classNames.booking.choosedTable)){
            table.classList.add(classNames.booking.choosedTable);
          } 
        }
      });
    }
  }
  rangeSlider(){
    const thisBooking = this;

    const bookedRange = thisBooking.booked[thisBooking.date];
    console.log('thisBooking', thisBooking.booked);
    console.log('bookedRange', bookedRange);
    const colors = [];

    const rangeSlider = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.rangeSlider);

    for(let bookedTime in bookedRange){
      const minHour = 12;
      const maxHour = 24;
      const step = 0.5;
      const start = ((bookedTime - minHour) * 100) / (maxHour - minHour);
      const end = (((bookedTime - minHour) + step) * 100) / (maxHour - minHour);
      
      if(bookedTime < maxHour){
        if(bookedRange[bookedTime].length <= 1){
          colors.push ('/*' + bookedTime + '*/#4cd137 ' + start + '%, #4cd137 ' + end + '%');
        } else if (bookedRange[bookedTime].length === 2){
          colors.push ('/*' + bookedTime + '*/#fbc531 ' + start + '%, #fbc531 ' + end + '%');
        } else if (bookedRange[bookedTime].length === 3){
          colors.push ('/*' + bookedTime + '*/#e84118 ' + start + '%, #e84118 ' + end + '%');
        }
      }
    }
    
    colors.sort();
    const pushedColors = colors.join();
    rangeSlider.style.background = 'linear-gradient(90deg, ' + pushedColors +')';

  }

  sendBooking(){
    let thisBooking = this;

    const url = settings.db.url + '/' + settings.db.booking;

    const bookingPayload = {
      date: thisBooking.date,
      hour: utils.numberToHour(thisBooking.hour),
      table: thisBooking.selectedTable,
      people: thisBooking.peopleAmount.value,
      duration: thisBooking.hoursAmount.value,
      phone: thisBooking.dom.phone.value,
      address: thisBooking.dom.adress.value,
      starters: [],
    };
    console.log('bookingPayload', bookingPayload);

    for (let starter of thisBooking.dom.starters){
      if (starter.checked == true){
        const starterValue = starter.value;
        bookingPayload.starters.push(starterValue);
      }
    }

    if(bookingPayload.phone == ''){
      alert('Please enter your phone');
    } else if (bookingPayload.address == ''){
      alert('Please enter your address');
    } else if (!bookingPayload.table){
      alert('Please choose a table');
    }

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingPayload),
    };
    fetch(url, options)
      .then(function(response){
        return response.json();
      })
      .then(function(){
        thisBooking.makeBooked(bookingPayload.date, bookingPayload.hour, bookingPayload.duration, bookingPayload.table);
        thisBooking.updateDOM();
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  render(element){
    const thisBooking = this;

    const generatedHTML = templates.bookingWidget();
    thisBooking.dom = {};
    thisBooking.dom.wrapper = element;
    thisBooking.dom.wrapper.innerHTML = generatedHTML;
    thisBooking.dom.peopleAmount = document.querySelector(select.booking.peopleAmount);
    thisBooking.dom.hoursAmount = document.querySelector(select.booking.hoursAmount);
    thisBooking.dom.datePicker = thisBooking.dom.wrapper.querySelector(select.widgets.datePicker.wrapper);
    thisBooking.dom.hourPicker = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.wrapper);
    thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(select.booking.tables);
    thisBooking.dom.phone = thisBooking.dom.wrapper.querySelector(select.booking.phone);
    thisBooking.dom.adress = thisBooking.dom.wrapper.querySelector(select.booking.address);
    thisBooking.dom.starters = thisBooking.dom.wrapper.querySelectorAll(select.booking.starter);
    thisBooking.dom.bookButton = thisBooking.dom.wrapper.querySelector(select.booking.bookButton);

  }

  initWidgets(){
    const thisBooking = this;

    thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);
    thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
    thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);

    thisBooking.dom.wrapper.addEventListener('updated', function(){
      thisBooking.updateDOM();
    });

    thisBooking.dom.hourPicker.addEventListener('updated', function(){
      for(let table of thisBooking.dom.tables){
        table.classList.remove(classNames.booking.choosedTable);
        thisBooking.selectedTable = '';
      }
    });

    thisBooking.dom.datePicker.addEventListener('updated', function(){
      for(let table of thisBooking.dom.tables){
        table.classList.remove(classNames.booking.choosedTable);
        thisBooking.selectedTable = '';
      }
    });

    thisBooking.dom.bookButton.addEventListener('click', function(){
      event.preventDefault();
      thisBooking.sendBooking();
    });
  }
}